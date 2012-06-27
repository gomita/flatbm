// This file is included in:
//  * Bookmarks Sidebar
var FlatBookmarks = {

	// xul:tree
	get tree() {
		return document.getElementById("bookmarks-view");
	},

	_makePlaceForFolder: function(aFolderId) {
		return "place:queryType=1&folder=" + aFolderId + "&expandQueries=false";
	},

	// nsIPrefBranch
	_branch: null,

	_inSearchMode: false,

	_backHistory: [],

	_mobileRootId: null,

	init: function() {
		// this fixes the problem that the old style tree appears in an eye's blink (1)
		document.documentElement.collapsed = true;
		this._branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).
		               getBranch("extensions.flatbm.");
		if (!this._branch.getBoolPref("clickOpensFolder")) {
			// disable opening folder with single click
			window.eval(
				"SidebarUtils.handleTreeClick = " + 
				SidebarUtils.handleTreeClick.toSource().replace(
					"tbo.view.toggleOpenState(row.value);", ""
				)
			);
		}
		// hook input in search bar and show or hide Flat Bookmarks toolbar
		window.eval(
			searchBookmarks.toSource().replace(
				"}}", 
				"} FlatBookmarks.onSearchBookmarks(aSearchString); }"
			)
		);
		// init search bar
		var textbox = document.getElementById("search-box");
		var label = document.getElementById("sidebar-search-label");
		textbox.setAttribute("placeholder", label.value.replace(/:$/, ""));
		textbox.setAttribute("accesskey", label.getAttribute("accesskey"));
		label.hidden = true;
		// set itemId of root folders
		var setElementItemId = function(aEltId, aItemId) {
			document.getElementById(aEltId).setAttribute("itemId", aItemId);
		};
		setElementItemId("editBMPanel_toolbarFolderItem", PlacesUtils.toolbarFolderId);
		setElementItemId("editBMPanel_bmRootItem",        PlacesUtils.bookmarksMenuFolderId);
		setElementItemId("editBMPanel_unfiledRootItem",   PlacesUtils.unfiledBookmarksFolderId);
		// set itemId of mobile root folder
		var mobileRoot = PlacesUtils.annotations.getItemsWithAnnotation("mobile/bookmarksRoot", {});
		if (mobileRoot.length != 0) {
			this._mobileRootId = mobileRoot[0];
			setElementItemId("mobileRootItem", this._mobileRootId);
			var button = document.getElementById("mobileRootItem");
			var bundle = Services.strings.createBundle("chrome://weave/locale/services/sync.properties");
			button.setAttribute("_title", bundle.GetStringFromName("mobile.label"));
			button.hidden = false;
		}
		// init go-up and back buttons
		var buttonSet = this._branch.getIntPref("buttonSet");
		document.getElementById("flatbm-goup").hidden = !(buttonSet & 1);
		document.getElementById("flatbm-back").hidden = !(buttonSet & 2);
		if (!this._branch.getBoolPref("expandSubFolders"))
			document.getElementById("flatbm-folders").removeAttribute("onclick");
		// init tree
		var tree = this.tree;
		tree.setAttribute("flatList", "true");
		tree.setAttribute("onopenflatcontainer", "FlatBookmarks.onOpenFlatContainer(aContainer);");
		tree.setAttribute("ondblclick", "FlatBookmarks.onDblClick(event);");
		this._setTreePlace(
			this._branch.getCharPref("place") || 
			this._makePlaceForFolder(PlacesUtils.bookmarksMenuFolderId)
		);
		// this fixes the problem that the old style tree appears in an eye's blink (2)
		document.documentElement.collapsed = false;
	},

	onOpenFlatContainer: function(aContainer) {
		// this fixes the problem (???) : 
		// when showing context menu, folder open and close in an eye's blink
		if (document.getElementById("placesContext").state == "open")
			return;
		// this fixes the problem: 
		// click event will occur just after changing the current folder with double-click
		setTimeout(function(self) { self.goDown(aContainer); }, 0, this);
	},

	onDblClick: function(aEvent) {
		if (aEvent.button != 0)
			return;
		var row = {};
		this.tree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, {});
		if (row.value == -1) {
			// when double-clicking on a blank space of tree...
			var cmd = document.getElementById("flatbmCmd:goUp");
			if (!cmd.hasAttribute("disabled"))
				cmd.doCommand();
		}
	},

	onSearchBookmarks: function(aSearchString) {
		this._inSearchMode = !!aSearchString;
		document.getElementById("flatbm-outer").hidden = this._inSearchMode;
		this._updateCommands();
	},

	_dragOverTime: null,	// time to start drag-over operation
	_dragOverItem: null,	// itemId of target folder for drag-over operation

	handleDropEvents: function(event) {
		if (event.target.localName != "folderitem" && event.target.localName != "toolbarbutton")
			return;
		// disallow drag-over operation onto search folders and livemark folders
		if (event.target.hasAttribute("query") || event.target.hasAttribute("livemark"))
			return;
		// allow drag opeartions only for the following data: 
		// * normal bookmark (text/x-moz-place)
		// * browser tab (application/x-moz-tabbrowser-tab)
		// * hyper lin (text/x-moz-url)
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
					// when dragging-over a folder for one second...
					this._dragOverTime = Date.now();
					if (!event.target.disabled)
						event.target.doCommand();
				}
				break;
			case "dragleave": 
				// this fixes the problem: current folder will be changed 
				// just after starting drag-over operation due to odd events sequence
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
				PlacesControllerDragHelper.currentDataTransfer = event.dataTransfer;
				PlacesControllerDragHelper.currentDropTarget = event.target;
				var ip = new InsertionPoint(itemId, -1, Ci.nsITreeView.DROP_ON, false);
				PlacesControllerDragHelper.onDrop(ip, event.dataTransfer);
				break;
			default: 
		}
	},

	generatePopup: function(event) {
		var expand = this._branch.getBoolPref("expandSubFolders");
		var popup = event.target;
		var itemId = event.target.parentNode.getAttribute("itemId");
		if (!itemId) alert("Assertion failed!");	// #debug
		// get the direct child folder's itemId for later use
		var childItemId = popup.parentNode.nextSibling ? 
		                  popup.parentNode.nextSibling.getAttribute("itemId") : null;
		var root = PlacesUtils.getFolderContents(itemId).root;
		var empty = true;
		for (var i = 0; i < root.childCount; i++) {
			var node = root.getChild(i);
			if (!PlacesUtils.nodeIsFolder(node) || this._nodeIsLivemark(node))
				continue;
			var eltName = expand ? "menu" : "menuitem";
			var elt = document.createElement(eltName);
			elt.setAttribute("class", eltName + "-iconic bookmark-item");
			elt.setAttribute("container", "true");
			elt.setAttribute("label", node.title);
			elt.setAttribute("itemId", node.itemId);
			if (node.itemId == childItemId)
				// if folder is one of the parent chain of the current folder, make the text bold
				// NOTE: |default| attribute is applied only to |menuitem| elements
				eltName == "menu" ? elt.style.fontWeight = "bold" : 
				                    elt.setAttribute("default", "true");
			if (expand)
				elt.appendChild(document.createElement("menupopup"));
			popup.appendChild(elt);
			empty = false;
		}
		if (empty) {
			// show dummy item
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
		// do nothing when clicking on a tag folder since cannot get appropriate place: URI for it
		if (event.target.getAttribute("query"))
			return;
		var itemId = event.target.getAttribute("itemId");
		if (!itemId) alert("Assertion failed!\nno itemId at " + event.target.id);	// #debug
		if (!itemId)
			return;
		this._setTreePlace(this._makePlaceForFolder(itemId));
	},

	goDown: function(aNode) {
		if (this._inSearchMode) {
			// if goDown is called during search mode, force exiting search mode
			// (assuming that being called from 'Show in Sidebar' menu)
			alert("force exiting search mode");	// #debug
			var searchBox = document.getElementById("search-box");
			searchBox.value = "";
			searchBox.doCommand();
		}
		// when moving into a search folder, save its itemId as pref
		// when moving into a tag folder, save its title as pref
		// saved values will be used in the forthcoming _setTreePlace
		// EXCEPTION: when moving from 'Recent Tags' to a tag folder, does not save daringly
		if (PlacesUtils.nodeIsQuery(aNode) && !PlacesUtils.nodeIsQuery(aNode.parent))
			this._branch.setIntPref("queryItemId", aNode.itemId);
		if (PlacesUtils.nodeIsTagQuery(aNode))
			this._setUnicharPref("queryTitle", aNode.title);
		this._setTreePlace(aNode.uri);
	},

	goUp: function() {
		var node = this.tree.view.result.root;
		var isQuery = PlacesUtils.nodeIsQuery(node);
		var itemId = isQuery ? this._branch.getIntPref("queryItemId") : node.itemId;
		itemId = PlacesUtils.bookmarks.getFolderIdForItem(itemId);
		this._setTreePlace(this._makePlaceForFolder(itemId));
	},

	back: function() {
		if (this._backHistory.length < 2)
			return;
		this._backHistory.pop();
		var [itemId, place] = this._backHistory.pop();
		// considering back to a search folder
		this._branch.setIntPref("queryItemId", itemId);
		this._setTreePlace(place);
	},

	// this will be called from: init, onButtonCommand, goDown, goUp
	_setTreePlace: function(aPlace) {
		if (/folder=(\d+)/.test(aPlace)) {
			var itemId = RegExp.$1;
			try {
				// check itemId exists
				PlacesUtils.bookmarks.getItemTitle(itemId);
			}
			catch (ex) {
				// NS_ERROR_ILLEGAL_VALUE is thrown since itemId does not exist
				alert("folder does not exist: " + itemId + "\n" + aPlace);	// #debug
				aPlace = this._makePlaceForFolder(PlacesUtils.bookmarksMenuFolderId);
			}
		}
		var tree = this.tree;
		tree.place = aPlace;
		tree.view.selection.clearSelection();
		// generate parent folders list
		var folders = document.getElementById("flatbm-folders");
		while (folders.hasChildNodes())
			folders.removeChild(folders.lastChild);
		var node = tree.view.result.root;
		var isQuery = PlacesUtils.nodeIsQuery(node);
		var isTagQuery = PlacesUtils.nodeIsTagQuery(node);
		var itemId = isQuery ? this._branch.getIntPref("queryItemId") : node.itemId;
		// keep the itemId of current folder before changing it for later use
		var rootItemId = itemId;
		// if using |PlacesUtils.isRootItem(itemId)| instead, we can stop showing root folders
		while (itemId && itemId != PlacesUtils.placesRootId) {
			var folder = document.createElement("folderitem");
			var id;
			switch (itemId) {
				case PlacesUtils.toolbarFolderId         : id = "editBMPanel_toolbarFolderItem"; break;
				case PlacesUtils.bookmarksMenuFolderId   : id = "editBMPanel_bmRootItem"; break;
				case PlacesUtils.unfiledBookmarksFolderId: id = "editBMPanel_unfiledRootItem"; break;
				default: 
			}
			// |buttonId| attribute is inherited to |id| of xul:toolbarbutton to show 
			// appropriate root folder icon @see bindings.xml
			if (id)
				folder.setAttribute("buttonId", id);
			folder.setAttribute("label", PlacesUtils.bookmarks.getItemTitle(itemId));
			folder.setAttribute("itemId", itemId);
			if (itemId == this._mobileRootId) {
				var button = document.getElementById("mobileRootItem");
				folder.setAttribute("label", button.getAttribute("_title"));
			}
			if (this._nodeIsLivemark(node))
				folder.setAttribute("livemark", "true");
			if (isQuery) {
				folder.setAttribute("query", "true");
				isQuery = false;
			}
			if (isTagQuery) {
				folder.setAttribute("tagContainer", "true");
				folder.setAttribute("label", this._getUnicharPref("queryTitle"));
				isTagQuery = false;
			}
			var popup = document.createElement("menupopup");
			popup.setAttribute("position", "end_before");
			folder.appendChild(popup);
			folders.insertBefore(folder, folders.firstChild);
			// go to the parent folder
			itemId = PlacesUtils.bookmarks.getFolderIdForItem(itemId);
		}
		// remember the last itemId of folder
		var lastItemId = this._backHistory.length > 0 ? 
		                 this._backHistory[this._backHistory.length - 1][0] : null;
		if (lastItemId != rootItemId)
			this._backHistory.push([rootItemId, aPlace]);
		this._updateCommands();
		this._branch.setCharPref("place", aPlace);
	},

	// this will be called from: onSearchBookmarks, _setTreePlace
	_updateCommands: function() {
		// enable go-up button if not in search mode and not showing root folder
		var itemId = this.tree.view.result.root.itemId;
		var canGoUp = !this._inSearchMode && !PlacesUtils.isRootItem(itemId) && 
		              itemId != this._mobileRootId;
		// enable back button if not in search mode and having back history
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

	_nodeIsLivemark: function(aNode) {
		return (
			PlacesUtils.annotations.itemHasAnnotation(aNode.itemId, PlacesUtils.LMANNO_FEEDURI)
		);
	},

	_setUnicharPref: function(aName, aValue) {
		var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		str.data = aValue;
		this._branch.setComplexValue(aName, Ci.nsISupportsString, str);
	},

	_getUnicharPref: function(aName) {
		var str = this._branch.getComplexValue(aName, Ci.nsISupportsString);
		return str.data;
	},

};


window.addEventListener("load", function() { FlatBookmarks.init(); }, false);


