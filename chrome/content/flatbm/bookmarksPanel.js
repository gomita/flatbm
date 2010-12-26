var FlatBookmarks = {

	get tree() {
		return document.getElementById("bookmarks-view");
	},

	_makePlaceForFolder: function(aFolderId) {
		return "place:queryType=1&folder=" + aFolderId + "&expandQueries=false";
	},

	_prefBranch: null,

	_inSearchMode: false,

	_backHistory: [],

	init: function() {
		// 従来のツリーが一瞬だけ表示される問題への対策 (1)
		document.documentElement.collapsed = true;
		// 設定値
		this._prefBranch = Cc["@mozilla.org/preferences-service;1"].
		                   getService(Ci.nsIPrefService).
		                   getBranch("extensions.flatbm.");
		if (!this._prefBranch.getBoolPref("clickOpensFolder")) {
			// シングルクリックでフォルダを開く操作を無効化
			window.eval(
				"SidebarUtils.handleTreeClick = " + 
				SidebarUtils.handleTreeClick.toSource().replace(
					"tbo.view.toggleOpenState(row.value);", ""
				)
			);
		}
		// 検索文字列が入力されている場合はツールバーを非表示にする
		window.eval(
			searchBookmarks.toSource().replace(
				"}}", 
				"} FlatBookmarks.onSearchBookmarks(aSearchString); }"
			)
		);
		// 検索ボックス
		// [Firefox3.5] ラベルのidが未設定のためpreviousSiblingで取得
		// 「textbox.emptyText = ...」だとサイドバーを開いた直後に一瞬ツリー表示が不正になる
		var textbox = document.getElementById("search-box");
		var label = document.getElementById("sidebar-search-label") || textbox.previousSibling;
		textbox.setAttribute("emptytext",   label.value.replace(/:$/, ""));	// [Firefox3.6]
		textbox.setAttribute("placeholder", label.value.replace(/:$/, ""));	// [Firefox3.7]
		textbox.setAttribute("accesskey", label.getAttribute("accesskey"));
		label.hidden = true;
		// [Firefox3.6] サイドバーオープン状態でFirefox起動時にemptytextが表示されない問題への対策
		textbox.focus();
		// ルートフォルダのitemId
		var setElementItemId = function(aEltId, aItemId) {
			document.getElementById(aEltId).setAttribute("itemId", aItemId);
		};
		setElementItemId("editBMPanel_toolbarFolderItem", PlacesUtils.toolbarFolderId);
		setElementItemId("editBMPanel_bmRootItem",        PlacesUtils.bookmarksMenuFolderId);
		setElementItemId("editBMPanel_unfiledRootItem",   PlacesUtils.unfiledBookmarksFolderId);
		// ツールバーボタン
		var buttonSet = this._prefBranch.getIntPref("buttonSet");
		document.getElementById("flatbm-goup").hidden = !(buttonSet & 1);
		document.getElementById("flatbm-back").hidden = !(buttonSet & 2);
		if (!this._prefBranch.getBoolPref("expandSubFolders"))
			document.getElementById("flatbm-folders").removeAttribute("onclick");
		// ツリー
		var tree = this.tree;
		tree.setAttribute("flatList", "true");
		tree.setAttribute("onopenflatcontainer", "FlatBookmarks.onOpenFlatContainer(aContainer);");
		tree.setAttribute("ondblclick", "FlatBookmarks.onDblClick(event);");
		this._setTreePlace(
			window.top.FlatBookmarksOverlay.place || 
			this._prefBranch.getCharPref("place") || 
			this._makePlaceForFolder(PlacesUtils.bookmarksMenuFolderId)
		);
		window.top.FlatBookmarksOverlay.place = null;
		// 従来のツリーが一瞬だけ表示される問題への対策 (2)
		document.documentElement.collapsed = false;
	},

	onOpenFlatContainer: function(aContainer) {
		// 右クリックメニューを開く際に一瞬フォルダが開閉するバグへの対策
		if (document.getElementById("placesContext").state == "open")
			return;
		// ダブルクリックでフォルダ遷移直後にクリックイベントが発生するバグへの対策
		setTimeout(function(self) { self.goDown(aContainer); }, 0, this);
	},

	onDblClick: function(aEvent) {
		if (aEvent.button != 0)
			return;
		var row = {};
		this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, {});
		if (row.value == -1) {
			// ツリーの余白をダブルクリック
			var command = document.getElementById("flatbmCmd:goUp");
			if (!command.hasAttribute("disabled"))
				command.doCommand();
		}
	},

	onSearchBookmarks: function(aSearchString) {
		this._inSearchMode = !!aSearchString;
		document.getElementById("flatbm-outer").hidden = this._inSearchMode;
		this._updateCommands();
	},

	_dragOverTime: null,	// dragenter の開始時刻
	_dragOverItem: null,	// dragenter されたフォルダのアイテムID

	handleDropEvents: function(event) {
		// 検索フォルダ・ライブマークフォルダ上でのドラッグ＆ドロップ操作を不許可
		if (event.target.hasAttribute("query") || event.target.hasAttribute("livemark"))
			return;
		// 以下のデータ形式のみドラッグ＆ドロップ操作を許可
		// ・ブックマーク: text/x-moz-place
		// ・ブラウザタブ: application/x-moz-tabbrowser-tab
		// ・リンク      : text/x-moz-url
		if (!event.dataTransfer.types.contains(PlacesUtils.TYPE_X_MOZ_PLACE) && 
		    !event.dataTransfer.types.contains(PlacesUtils.TYPE_X_MOZ_URL) && 
		    !event.dataTransfer.types.contains(TAB_DROP_TYPE))
			return;
		event.preventDefault();
		switch (event.type) {
			case "dragenter": 
				this._dragOverTime = Date.now();
				this._dragOverItem = event.target.getAttribute("itemId");
				event.target.setAttribute("open", "true");
				break;
			case "dragover": 
				if (Date.now() - this._dragOverTime > 1000) {
					this._dragOverTime = Date.now();
					if (!event.target.disabled)
						event.target.doCommand();
				}
				break;
			case "dragleave": 
				this._dragOverTime = null;
				this._dragOverItem = null;
				event.target.removeAttribute("open");
				break;
			case "drop": 
				this._dragOverTime = null;
				this._dragOverItem = null;
				event.target.removeAttribute("open");
				var itemId = event.target.getAttribute("itemId");
				if (!itemId)
					return;
				// [Firefox3.6] PlacesControllerDragHelper.onDrop(insertionPoint)
				// [Firefox3.7] PlacesControllerDragHelper.onDrop(insertionPoint, dt)
				PlacesControllerDragHelper.currentDataTransfer = event.dataTransfer;
				PlacesControllerDragHelper.currentDropTarget = event.target;
				var ip = new InsertionPoint(itemId, -1, Ci.nsITreeView.DROP_ON, false);
				PlacesControllerDragHelper.onDrop(ip, event.dataTransfer);
				break;
			default: 
		}
	},

	generatePopup: function(event) {
		var expand = this._prefBranch.getBoolPref("expandSubFolders");
		var popup = event.target;
		var itemId = event.target.parentNode.getAttribute("itemId");
/*debug*/if (!itemId) alert("Assertion failed!");
		// 一階層下のフォルダのitemIdがあれば取得
		var childItemId = popup.parentNode.nextSibling ? 
		                  popup.parentNode.nextSibling.getAttribute("itemId") : null;
		var root = PlacesUtils.getFolderContents(itemId).root;
		var empty = true;
		for (var i = 0; i < root.childCount; i++) {
			var node = root.getChild(i);
			if (!PlacesUtils.nodeIsFolder(node) || PlacesUtils.nodeIsLivemarkContainer(node))
				continue;
			var eltName = expand ? "menu" : "menuitem";
			var elt = document.createElement(eltName);
			elt.setAttribute("class", eltName + "-iconic bookmark-item");
			elt.setAttribute("container", "true");
			elt.setAttribute("label", node.title);
			elt.setAttribute("itemId", node.itemId);
			if (node.itemId == childItemId)
				elt.setAttribute("default", "true");
			if (expand)
				elt.appendChild(document.createElement("menupopup"));
			popup.appendChild(elt);
			empty = false;
		}
		if (empty) {
			// 「(なし)」の項目を表示
			var elt = document.createElement("menuitem");
			elt.setAttribute("label", PlacesUIUtils.getString("bookmarksMenuEmptyFolder"));
			elt.setAttribute("disabled", "true");
			popup.appendChild(elt);
		}
	},

	destroyPopup: function(event) {
		var popup = event.target;
		while (popup.hasChildNodes())
			popup.removeChild(popup.lastChild);
	},

	onPopupClick: function(event) {
		if (event.button != 0 || event.target.localName != "menu")
			return;
		var elt = event.target;
		while (elt && elt.localName != "folderitem") {
			if (elt.localName == "menupopup")
				elt.hidePopup();
			elt = elt.parentNode;
		}
		var itemId = event.target.getAttribute("itemId");
		this._setTreePlace(this._makePlaceForFolder(itemId));
	},

	onButtonCommand: function(event) {
		// XXX place:URIが不明なため、検索フォルダへの遷移を許可しない
		if (event.target.getAttribute("query"))
			return;
		var itemId = event.target.getAttribute("itemId");
/*debug*/if (!itemId) alert("Assertion failed!\nno itemId at " + event.target.id);
		if (!itemId)
			return;
		this._setTreePlace(this._makePlaceForFolder(itemId));
	},

	goDown: function(aNode) {
		if (this._inSearchMode) {
			// 検索モードON中に右クリックメニューからgoDown呼び出し→検索モードOFF
/*debug*/	alert("escape from search mode");
			var searchBox = document.getElementById("search-box");
			searchBox.value = "";
			searchBox.doCommand();
		}
		// 検索フォルダへの遷移時、検索フォルダのitemIdを設定値として保存する
		// タグフォルダへの遷移時、タグフォルダのタイトルを設定値として保存する
		// 設定値として保存した値は、直後の親フォルダリスト生成時に使用する
		// XXX ただし、「最近付けたタグ」からタグフォルダへの遷移時はあえてitemIdの保存を行わない
		if (PlacesUtils.nodeIsQuery(aNode) && !PlacesUtils.nodeIsQuery(aNode.parent))
			this._prefBranch.setIntPref("queryItemId", aNode.itemId);
		if (PlacesUtils.nodeIsTagQuery(aNode))
			this._setStringPref("queryTitle", aNode.title);
		this._setTreePlace(aNode.uri);
	},

	goUp: function() {
		var node = this.tree.view.result.root;
		var isQuery = PlacesUtils.nodeIsQuery(node);
		var itemId = isQuery ? this._prefBranch.getIntPref("queryItemId") : node.itemId;
		itemId = PlacesUtils.bookmarks.getFolderIdForItem(itemId);
		this._setTreePlace(this._makePlaceForFolder(itemId));
	},

	back: function() {
		if (this._backHistory.length < 2)
			return;
/*debug*/Application.console.log(this._backHistory.join("\n"));
		this._backHistory.pop();
		var [itemId, place] = this._backHistory.pop();
		// 検索フォルダの場合を考慮
		this._prefBranch.setIntPref("queryItemId", itemId);
		this._setTreePlace(place);
	},

	/**
	 * @caller init, onButtonCommand, goDown, goUp
	 */
	_setTreePlace: function(aPlace) {
		if (/folder=(\d+)/.test(aPlace)) {
			var itemId = RegExp.$1;
			try {
				// itemIdが存在するかのチェック
				PlacesUtils.bookmarks.getItemTitle(itemId);
			}
			catch (ex) {
				// 存在しないフォルダを表示しようとした場合 NS_ERROR_ILLEGAL_VALUE
/*debug*/		alert("folder does not exist: " + itemId + "\n" + aPlace);
				aPlace = this._makePlaceForFolder(PlacesUtils.bookmarksMenuFolderId);
			}
		}
		var tree = this.tree;
		tree.place = aPlace;
		// ツリーの選択を解除
		tree.view.selection.clearSelection();
		// フォルダリスト生成
		var folders = document.getElementById("flatbm-folders");
		while (folders.hasChildNodes())
			folders.removeChild(folders.lastChild);
		// itemIdを取得
		var node = tree.view.result.root;
		var isQuery = PlacesUtils.nodeIsQuery(node);
		var isTagQuery = PlacesUtils.nodeIsTagQuery(node);
		var itemId = isQuery ? this._prefBranch.getIntPref("queryItemId") : node.itemId;
		// 履歴への追加処理で参照するために現時点のitemIdを保持
		var rootItemId = itemId;
		// ルートフォルダを表示させない場合: while (!PlacesUtils.isRootItem(itemId)) {
		while (itemId && itemId != PlacesUtils.placesRootId) {
			var folder = document.createElement("folderitem");
			var id;
			switch (itemId) {
				case PlacesUtils.toolbarFolderId         : id = "editBMPanel_toolbarFolderItem"; break;
				case PlacesUtils.bookmarksMenuFolderId   : id = "editBMPanel_bmRootItem"; break;
				case PlacesUtils.unfiledBookmarksFolderId: id = "editBMPanel_unfiledRootItem"; break;
				default: 
			}
			if (id)
				// ルートフォルダのみbuttonId属性をセットし、XBLで匿名toolbarbutton要素のidへと継承して、
				// ルートフォルダ用の適切なアイコンを表示させる。
				folder.setAttribute("buttonId", id);
			folder.setAttribute("label", PlacesUtils.bookmarks.getItemTitle(itemId));
			folder.setAttribute("itemId", itemId);
			// [Firefox3.5] use nsILivemarkService instead of PlacesUtils.itemIsLivemark
			var isLivemark = PlacesUtils.itemIsLivemark ? PlacesUtils.itemIsLivemark(itemId) : 
			                 PlacesUtils.livemarks.isLivemark(itemId);
			if (isLivemark)
				folder.setAttribute("livemark", "true");
			if (isQuery) {
				folder.setAttribute("query", "true");
				isQuery = false;
			}
			if (isTagQuery) {
				folder.setAttribute("tagContainer", "true");
				folder.setAttribute("label", this._getStringPref("queryTitle"));
				isTagQuery = false;
			}
			var popup = document.createElement("menupopup");
			popup.setAttribute("position", "end_before");
			folder.appendChild(popup);
			folders.insertBefore(folder, folders.firstChild);
			// 親フォルダへ
			itemId = PlacesUtils.bookmarks.getFolderIdForItem(itemId);
		}
		// 履歴の保持
		var lastItemId = this._backHistory.length > 0 ? 
		                 this._backHistory[this._backHistory.length - 1][0] : null;
		if (lastItemId != rootItemId)
			this._backHistory.push([rootItemId, aPlace]);
		// コマンドの有効化/無効化
		this._updateCommands();
		// 状態の記憶
		this._prefBranch.setCharPref("place", aPlace);
/*debug*/// Application.console.log(new Date().toLocaleTimeString() + " " + aPlace);
	},

	/**
	 * @caller onSearchBookmarks, _setTreePlace
	 */
	_updateCommands: function() {
		// 検索モードOFFでなおかつルートフォルダでなければgoUp可能
		var canGoUp = !this._inSearchMode && !PlacesUtils.isRootItem(this.tree.view.result.root.itemId);
		// 検索モードOFFでなおかつ前のフォルダの履歴があればback可能
		var canBack = !this._inSearchMode && this._backHistory.length >= 2;
		var setElementDisabled = function(aEltId, aDisabled) {
			var elt = document.getElementById(aEltId);
			if (aDisabled)
				elt.setAttribute("disabled", "true");
			else
				elt.removeAttribute("disabled");
		};
		setElementDisabled("flatbmCmd:goUp", !canGoUp);
		setElementDisabled("flatbmCmd:back", !canBack);
	},

	_setStringPref: function(aPrefName, aValue) {
		var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		str.data = aValue;
		this._prefBranch.setComplexValue(aPrefName, Ci.nsISupportsString, str);
	},

	_getStringPref: function(aPrefName) {
		var str = this._prefBranch.getComplexValue(aPrefName, Ci.nsISupportsString);
		return str.data;
	},

};


window.addEventListener("load", function() { FlatBookmarks.init(); }, false);


