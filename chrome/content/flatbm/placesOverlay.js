var FlatBookmarksOverlay = {

	place: null,

	init: function() {
		if (!Application.prefs.get("extensions.flatbm.showInSidebarMenu").value) {
			var menu = document.getElementById("flatbmContext_showInSidebar");
			menu.parentNode.removeChild(menu);
		}
		if (!Application.prefs.get("extensions.flatbm.showInOrganizerMenu").value) {
			var menu = document.getElementById("flatbmContext_showInOrganizer");
			menu.parentNode.removeChild(menu);
		}
		// XXXブックマークの管理ウィンドウを開く際のarguments[1]にitemIdを渡すとそのアイテムを選択する
		if ("PlacesOrganizer" in window && window.arguments && window.arguments[1]) {
			PlacesOrganizer._places.selectItems([window.arguments[1]], true);
			PlacesOrganizer._places.focus();
		}
	},

	showInSidebar: function() {
		var view = PlacesUIUtils.getViewForNode(document.popupNode);
		var node = view.selectedNode;
		// 「履歴とブックマークの管理」の左ペーンから「サイドバーで表示」を実行すると、
		// サイドバーにフォルダしか表示されないバグへの対策。
		// 「履歴とブックマークの管理」の左ペーンではexcludeItemsをtrueにすることで、
		// フォルダ以外の項目検索を抑止している。
		if (node.queryOptions.excludeItems)
			node.queryOptions.excludeItems = false;
		var winMed = Cc["@mozilla.org/appshell/window-mediator;1"].
		             getService(Ci.nsIWindowMediator);
		var win = winMed.getMostRecentWindow("navigator:browser");
		var sidebar = win.document.getElementById("sidebar");
		const sidebarURI = "chrome://browser/content/bookmarks/bookmarksPanel.xul";
		if (sidebar.getAttribute("src") == sidebarURI) {
			sidebar.contentWindow.FlatBookmarks.goDown(node);
		}
		else {
			if (PlacesUtils.nodeIsQuery(node) && !PlacesUtils.nodeIsQuery(node.parent))
				Application.prefs.get("extensions.flatbm.queryItemId").value = node.itemId;
			if (PlacesUtils.nodeIsTagQuery(node))
				Application.prefs.get("extensions.flatbm.queryTitle").value = node.title;
			win.FlatBookmarksOverlay.place = node.uri;
			win.toggleSidebar("viewBookmarksSidebar");
			win.focus();
		}
	},

	showInOrganizer: function() {
		var view = PlacesUIUtils.getViewForNode(document.popupNode);
		var itemId = view.selectedNode.itemId;
		var winMed = Cc["@mozilla.org/appshell/window-mediator;1"].
		             getService(Ci.nsIWindowMediator);
		var win = winMed.getMostRecentWindow("Places:Organizer");
		if (!win) {
			openDialog("chrome://browser/content/places/places.xul", "", 
			           "chrome,toolbar=yes,dialog=no,resizable", "AllBookmarks", itemId);
		}
		else {
			win.PlacesOrganizer._places.selectItems([itemId], true);
			win.PlacesOrganizer._places.focus();
			win.setTimeout(function() { win.focus(); }, 0);
		}
	},

};


window.addEventListener("load", function() { FlatBookmarksOverlay.init(); }, false);


