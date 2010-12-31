var FlatBookmarksOverlay = {

	get fx4() {
		var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
		delete this.fx4;
		return this.fx4 = parseFloat(appInfo.version) >= 4;
	},

	get mac() {
		delete this.mac;
		return this.mac = navigator.platform.indexOf("Mac") == 0;
	},

	place: null,

	// cached prefs
	_showInSidebarMenu: false,
	_showInOrganizerMenu: false,

	init: function() {
		this._showInSidebarMenu   = Application.prefs.get("extensions.flatbm.showInSidebarMenu").value;
		this._showInOrganizerMenu = Application.prefs.get("extensions.flatbm.showInOrganizerMenu").value;
		if (!this._showInSidebarMenu) {
			var menu = document.getElementById("flatbmContext_showInSidebar");
			menu.parentNode.removeChild(menu);
		}
		if (!this._showInOrganizerMenu) {
			var menu = document.getElementById("flatbmContext_showInOrganizer");
			menu.parentNode.removeChild(menu);
		}
		if ((this._showInSidebarMenu || this._showInOrganizerMenu) && 
		    window.location.href == "chrome://browser/content/browser.xul") {
			// XXXhack to add extra menu items to bookmark folders' menu popup
			if (this.fx4) {
				window.eval(
					"PlacesViewBase.prototype._onPopupShowing = " + 
					PlacesViewBase.prototype._onPopupShowing.toSource().replace(
						/\}\)$/, "FlatBookmarksOverlay.addCommandsItems(popup);})"
					)
				);
			}
			else {
				window.eval(
					"BookmarksEventHandler.onPopupShowing = " + 
					BookmarksEventHandler.onPopupShowing.toSource().replace(
						/\}\)$/, "FlatBookmarksOverlay.addCommandsItems(target);})"
					)
				);
			}
		}
		// XXXブックマークの管理ウィンドウを開く際のarguments[1]にitemIdを渡すとそのアイテムを選択する
		if ("PlacesOrganizer" in window && window.arguments && window.arguments[1]) {
			PlacesOrganizer._places.selectItems([window.arguments[1]], true);
			PlacesOrganizer._places.focus();
		}
	},

	addCommandsItems: function(aPopup) {
		if (aPopup.lastChild.className != "openintabs-menuitem")
			// don't add extra menu items if last menu item of popup is not 'Open All in Tabs'
			// this also avoids duplication of extra menu items for same popup
			return;
		if (PlacesUtils.nodeIsTagQuery(this.fx4 ? aPopup._placesNode : aPopup._resultNode))
			// don't add extra menu items if popup is of a tag
			return;
		if (this._showInSidebarMenu) {
			var elt = document.createElement("menuitem");
			elt.setAttribute("label", 
				document.getElementById("flatbmContext_showInSidebar").label
			);
			elt.setAttribute("oncommand", 
				this.fx4 ? "FlatBookmarksOverlay.showInSidebar(this.parentNode._placesNode);"
				         : "FlatBookmarksOverlay.showInSidebar(this.parentNode._resultNode);"
			);
			aPopup.appendChild(elt);
			// [Mac] don't show icon of extra menu item
			if (this.mac)
				elt.style.listStyleImage = "none";
		}
		if (this._showInOrganizerMenu) {
			var elt = document.createElement("menuitem");
			elt.setAttribute("label", 
				document.getElementById("flatbmContext_showInOrganizer").label
			);
			elt.setAttribute("oncommand", 
				this.fx4 ? "FlatBookmarksOverlay.showInOrganizer(this.parentNode._placesNode);"
				         : "FlatBookmarksOverlay.showInOrganizer(this.parentNode._resultNode);"
			);
			aPopup.appendChild(elt);
			// [Mac] don't show icon of extra menu item
			if (this.mac)
				elt.style.listStyleImage = "none";
		}
	},

	showInSidebar: function(aNode) {
		if (!aNode)
			aNode = PlacesUIUtils.getViewForNode(document.popupNode).selectedNode;
		// 「履歴とブックマークの管理」の左ペーンから「サイドバーで表示」を実行すると、
		// サイドバーにフォルダしか表示されないバグへの対策。
		// 「履歴とブックマークの管理」の左ペーンではexcludeItemsをtrueにすることで、
		// フォルダ以外の項目検索を抑止している。
		if (aNode.queryOptions && aNode.queryOptions.excludeItems)
			aNode.queryOptions.excludeItems = false;
		var winMed = Cc["@mozilla.org/appshell/window-mediator;1"].
		             getService(Ci.nsIWindowMediator);
		var win = winMed.getMostRecentWindow("navigator:browser");
		var sidebar = win.document.getElementById("sidebar");
		const sidebarURI = "chrome://browser/content/bookmarks/bookmarksPanel.xul";
		if (sidebar.getAttribute("src") == sidebarURI) {
			sidebar.contentWindow.FlatBookmarks.goDown(aNode);
		}
		else {
			if (PlacesUtils.nodeIsQuery(aNode) && !PlacesUtils.nodeIsQuery(aNode.parent))
				Application.prefs.get("extensions.flatbm.queryItemId").value = aNode.itemId;
			if (PlacesUtils.nodeIsTagQuery(aNode))
				Application.prefs.get("extensions.flatbm.queryTitle").value = aNode.title;
			win.FlatBookmarksOverlay.place = aNode.uri;
			win.toggleSidebar("viewBookmarksSidebar");
			win.focus();
		}
	},

	showInOrganizer: function(aNode) {
		if (!aNode)
			aNode = PlacesUIUtils.getViewForNode(document.popupNode).selectedNode;
		var win = Cc["@mozilla.org/appshell/window-mediator;1"].
		          getService(Ci.nsIWindowMediator).
		          getMostRecentWindow("Places:Organizer");
		if (!win) {
			openDialog("chrome://browser/content/places/places.xul", "", 
			           "chrome,toolbar=yes,dialog=no,resizable", "AllBookmarks", aNode.itemId);
		}
		else {
			win.PlacesOrganizer._places.selectItems([aNode.itemId], true);
			win.PlacesOrganizer._places.focus();
			win.setTimeout(function() { win.focus(); }, 0);
		}
	},

};


window.addEventListener("load", function() { FlatBookmarksOverlay.init(); }, false);


