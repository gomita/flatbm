const NHQO = Ci.nsINavHistoryQueryOptions;

var FlatHistory = {

	_prefBranch: null,

	_inSearchMode: false,

	_backHistory: [],

	get dateFormatBundle() {
		const STRING_BUNDLE_URI = "chrome://global/locale/dateFormat.properties";
		delete this.dateFormatBundle;
		return this.dateFormatBundle = Cc["@mozilla.org/intl/stringbundle;1"].
		                               getService(Ci.nsIStringBundleService).
		                               createBundle(STRING_BUNDLE_URI);
	},

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
				SidebarUtils.handleTreeClick.toString().replace(
					"tbo.view.toggleOpenState(row.value);", ""
				)
			);
		}
		// place変更時のコールバックを設定
		window.eval(
			"gHistoryTree.load = " + 
			gHistoryTree.load.toString().replace(/\}$/, "FlatHistory.onPlaceChange(); }")
		);
		// 検索ボックス
		// [Firefox3.5] ラベルのidが未設定のためpreviousSiblingで取得
		var label = document.getElementById("sidebar-search-label") || gSearchBox.previousSibling;
		gSearchBox.setAttribute("emptytext",   label.value.replace(/:$/, ""));	// [Firefox3.6]
		gSearchBox.setAttribute("placeholder", label.value.replace(/:$/, ""));	// [Firefox3.7]
		gSearchBox.setAttribute("accesskey", label.getAttribute("accesskey"));
		label.hidden = true;
		// [Firefox3.6] サイドバーオープン状態でFirefox起動時にemptytextが表示されない問題への対策
		gSearchBox.focus();
		// グルーピング選択メニュー
		var viewButton = document.getElementById("viewButton");
		var viewMenu   = document.getElementById("viewMenu");
		viewMenu.appendChild(viewButton.firstChild);
		viewMenu.label = viewButton.label;
		viewButton.hidden = true;
		// [Mac][Firefox4] list-style-imageが適用されないため「表示」ボタンのアイコンが表示されない問題への対策
		if (window.getComputedStyle(viewMenu, null).listStyleImage == "none")
			viewMenu.setAttribute("_noiconic", "true");
		// 履歴ボタン
		var rootButton = document.getElementById("flatbm-history-button");
		rootButton.label = PlacesUIUtils.getString("OrganizerQueryHistory");
		// ツールバーボタン
		var buttonSet = this._prefBranch.getIntPref("buttonSet");
		document.getElementById("flatbm-goup").hidden = !(buttonSet & 1);
		document.getElementById("flatbm-back").hidden = !(buttonSet & 2);
		if (!this._prefBranch.getBoolPref("expandSubFolders"))
			document.getElementById("flatbm-folders").removeAttribute("onclick");
		// ツリー
		var lastPlaceURI = this._prefBranch.getCharPref("place.history");
		if (lastPlaceURI)
			gHistoryTree.place = lastPlaceURI;
		else
			this.onPlaceChange();
		// 従来のツリーが一瞬だけ表示される問題への対策 (2)
		document.documentElement.collapsed = false;
	},

	onOpenFlatContainer: function(aContainer) {
		// 右クリックメニューを開く際に一瞬フォルダが開閉するバグへの対策
		if (document.getElementById("placesContext").state == "open")
			return;
		// ダブルクリックでフォルダ遷移直後にクリックイベントが発生するバグへの対策
		setTimeout(function() { gHistoryTree.place = aContainer.uri; }, 0);
	},

	onPlaceChange: function() {
		// place:URIからクエリを逆算
		var place = gHistoryTree.view.result.root.uri;
		var query = {};
		PlacesUtils.history.queryStringToQueries(place, query, {}, {});
		query = query.value[0];
		this._inSearchMode = query.hasSearchTerms;
/*debug*/Application.console.log(new Date().toLocaleTimeString() + " " + place);
		// UI更新
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		groupDay.hidden = true;
		groupSite.hidden = true;
		document.getElementById("flatbm-toolbar").hidden = this._inSearchMode;
		// 日付ボタン更新
		if (query.hasBeginTime && query.hasEndTime) {
			// beginTime, endTime, 現在時刻をDateオブジェクトに変換して適切なラベルを決定する
			var beginDate = new Date(parseInt(query.beginTime) / 1000);
			var endDate   = new Date(parseInt(query.endTime)   / 1000);
			var nowDate   = new Date(new Date().toDateString());
			var beginToEnd = (endDate.getTime() - beginDate.getTime()) / 1000 / 60 / 60 / 24;
			var endToNow   = (nowDate.getTime() - endDate.getTime())   / 1000 / 60 / 60 / 24;
			var label = "";
			if (beginToEnd == 1 && endToNow == -1)
				// Today
				label = PlacesUtils.getString("finduri-AgeInDays-is-0");
			else if (beginToEnd == 1 && endToNow == 0)
				// Yesterday
				label = PlacesUtils.getString("finduri-AgeInDays-is-1");
			else if (beginToEnd == 8 && endToNow == -1)
				// Last 7 days
				label = PlacesUtils.getFormattedString("finduri-AgeInDays-last-is", [7]);
			else {
				var beginMonth = beginDate.getMonth() + 1;
				var endMonth   = endDate.getMonth()   + 1;
				beginToEnd = (endDate.getFullYear()   * 12 + endMonth)
				           - (beginDate.getFullYear() * 12 + beginMonth);
				if (beginToEnd == 0)
					// This month
					label = PlacesUtils.getString("finduri-AgeInMonths-is-0");
				else if (beginToEnd > 1)
					// Older than 6 months
					label = PlacesUtils.getFormattedString("finduri-AgeInMonths-isgreater", [6]);
				else {
					// A month
					label = this.dateFormatBundle.GetStringFromName("month." + beginMonth + ".name");
					if (beginDate.getFullYear() != nowDate.getFullYear())
						label += " " + beginDate.getFullYear();
				}
			}
			// 日付ボタン押下時のplace:URIを決定する
			var newQuery = query.clone();
			var newOptions = PlacesUtils.history.getNewQueryOptions();
			newQuery.domainIsHost = false;
			newQuery.domain = null;
			newOptions.sortingMode = NHQO.SORT_BY_TITLE_ASCENDING;
			if (gHistoryGrouping == "dayandsite")
				newOptions.resultType = NHQO.RESULTS_AS_SITE_QUERY;
			var uri = PlacesUtils.history.queriesToQueryString([newQuery], 1, newOptions);
			// UI更新
			groupDay.hidden = false;
			groupDay.setAttribute("label", label);
			groupDay.setAttribute("uri", uri);
/*debug*/	groupDay.setAttribute("tooltiptext", uri);
		}
		// サイトボタン更新
		if (query.domainIsHost) {
			groupSite.hidden = false;
			groupSite.setAttribute("label", query.domain || PlacesUtils.getString("localhost"));
			groupSite.setAttribute("uri", place);
/*debug*/	groupSite.setAttribute("tooltiptext", place);
		}
		// 履歴の保持
		if (!this._inSearchMode) {
			var lastPlace = this._backHistory.length > 0 ? 
			                this._backHistory[this._backHistory.length - 1] : null;
			if (lastPlace != place)
				this._backHistory.push(place);
		}
		// コマンドの有効化/無効化
		this._updateCommands();
		// 状態の記憶
		if (!this._inSearchMode)
			this._prefBranch.setCharPref("place.history", place);
	},

	onGroupingChange: function() {
		// 最後の履歴のみを残して、それ以前の履歴を削除
		this._backHistory = this._backHistory.splice(-1);
		this._updateCommands();
	},

	_expandDayGroup: false,

	generatePopup: function(event) {
		var popup = event.target;
		var query, options;
		if (gHistoryGrouping == "dayandsite" && popup.parentNode.id != "flatbm-group-day") {
			var uri;
			if (popup.parentNode.id == "flatbm-group-site")
				// グルーピングが「日付とサイト名順」でサイトボタンのメニューを開く場合
				// 日付ボタンのplace:URIからクエリを逆算する
				uri = document.getElementById("flatbm-group-day").getAttribute("uri");
			else
				// グルーピングが「日付とサイト名順」で日付ボタンのサイトサブメニューを開く場合
				// 親の日付サブメニューのplace:URIからクエリを逆算する
				uri = popup.parentNode.getAttribute("uri");
			var queriesRef = {}, optionsRef = {};
			PlacesUtils.history.queryStringToQueries(uri, queriesRef, {}, optionsRef);
			query = queriesRef.value[0];
			options = optionsRef.value;
		}
		else {
			// それ以外の場合、履歴ルート相当のクエリを生成する
			// @see searchHistory
			query = PlacesUtils.history.getNewQuery();
			options = PlacesUtils.history.getNewQueryOptions();
			switch (gHistoryGrouping) {
				case "dayandsite": 
					options.resultType = NHQO.RESULTS_AS_DATE_SITE_QUERY;
					break;
				case "site": 
					options.resultType = NHQO.RESULTS_AS_SITE_QUERY;
					options.sortingMode = NHQO.SORT_BY_TITLE_ASCENDING;
					break;
				case "day": 
				default: 
					options.resultType = NHQO.RESULTS_AS_DATE_QUERY;
					break;
			}
		}
		// 日付グループのサブメニュー展開？
		this._expandDayGroup = (
			gHistoryGrouping == "dayandsite" && 
			popup.parentNode.id == "flatbm-group-day" && 
			this._prefBranch.getBoolPref("expandSubFolders")
		);
		var root = PlacesUtils.history.executeQueries([query], 1, options).root;
		root.containerOpen = true;
		this._asyncPopup = popup;
		this._asyncQueue = [];
		for (var i = 0; i < root.childCount; i++) {
			var node = root.getChild(i);
			this._asyncQueue.push({ title: node.title, uri: node.uri });
		}
		this._asyncNext();
	},

	_asyncTimer: null,
	_asyncPopup: null,
	_asyncQueue: null,
	_asyncNext: function() {
		var node = this._asyncQueue.shift();
		if (!node)
			return;
		var eltName = this._expandDayGroup ? "menu" : "menuitem";
		var elt = document.createElement(eltName);
		elt.setAttribute("class", eltName + "-iconic bookmark-item");
		elt.setAttribute("query", "true");
		if (this._asyncPopup.parentNode.id == "flatbm-group-day")
			elt.setAttribute("dayContainer", "true");
		else if (this._asyncPopup.parentNode.id == "flatbm-group-site" || 
		         this._asyncPopup.parentNode.parentNode.parentNode.id == "flatbm-group-day")
			elt.setAttribute("hostContainer", "true");
		elt.setAttribute("label", node.title);
		elt.setAttribute("uri", node.uri);
/*debug*/elt.setAttribute("tooltiptext", node.uri);
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		if ((!groupDay.hidden  && node.uri == groupDay.getAttribute("uri")) || 
		    (!groupSite.hidden && node.uri == groupSite.getAttribute("uri"))) {
			if (eltName == "menuitem")
				elt.setAttribute("default", "true");
			else
				elt.setAttribute("style", "font-weight: bold;");
		}
		if (this._expandDayGroup)
			elt.appendChild(document.createElement("menupopup"));
		this._asyncPopup.appendChild(elt);
		// 次のキューへ
		if (this._asyncQueue.length % 50 == 0)
			this._asyncTimer = setTimeout(function(self) { self._asyncNext(); }, 0, this);
		else
			this._asyncNext();
	},

	destroyPopup: function(event) {
		if (this._asyncTimer) {
			clearTimeout(this._asyncTimer);
			this._asyncTimer = null;
		}
		this._asyncPopup = null;
		this._asyncQueue = null;
		var popup = event.target;
		while (popup.hasChildNodes())
			popup.removeChild(popup.lastChild);
	},

	onButtonCommand: function(event) {
		gHistoryTree.place = event.target.getAttribute("uri");
	},

	_updateCommands: function() {
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		// 検索モードOFFでなおかつルートフォルダでなければgoUp可能
		var canGoUp = !this._inSearchMode && (!groupDay.hidden || !groupSite.hidden);
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

	goUp: function() {
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		if (!groupSite.hidden && !groupDay.hidden)
			// 日付ボタンとサイトボタンともに表示されている場合に限り、日付ボタンを押下
			groupDay.doCommand();
		else
			// それ以外はルートへ移動
			document.getElementById("flatbm-history-button").doCommand();
	},

	back: function() {
/*debug*/if (document.getElementById("flatbmCmd:back").getAttribute("disabled") == "true") alert("called disable command!");
		if (this._backHistory.length < 2)
			return;
/*debug*/Application.console.log(this._backHistory.join("\n"));
		this._backHistory.pop();
		gHistoryTree.place = this._backHistory.pop();
	},

	onDblClick: function(aEvent) {
		if (aEvent.button != 0)
			return;
		var row = {};
		gHistoryTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, {});
		if (row.value == -1) {
			// ツリーの余白をダブルクリック
			var command = document.getElementById("flatbmCmd:goUp");
			if (!command.hasAttribute("disabled"))
				command.doCommand();
		}
	},

};


window.eval(HistorySidebarInit.toString().replace("viewButton", "viewMenu"));
window.addEventListener("load", function() { FlatHistory.init(); }, false);


