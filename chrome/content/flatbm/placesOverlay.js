// This file is included in:
//  * Browser Window
//  * Bookmarks Sidebar
//  * History Sidebar
//  * Library
var FlatBookmarksOverlay = {

	get fx4() {
		var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
		delete this.fx4;
		return this.fx4 = parseFloat(appInfo.version) >= 4.0;
	},

	get mac() {
		delete this.mac;
		return this.mac = navigator.platform.indexOf("Mac") == 0;
	},

	get branch() {
		return Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).
		       getBranch("extensions.flatbm.");
	},

	// cached prefs
	_showInSidebarMenu: false,
	_showInOrganizerMenu: false,

	init: function() {
		var branch = this.branch;
		this._showInSidebarMenu   = branch.getBoolPref("showInSidebarMenu");
		this._showInOrganizerMenu = branch.getBoolPref("showInOrganizerMenu");
		if (!this._showInSidebarMenu) {
			var elt = document.getElementById("flatbmContext_showInSidebar");
			elt.parentNode.removeChild(elt);
		}
		if (!this._showInOrganizerMenu) {
			var elt = document.getElementById("flatbmContext_showInOrganizer");
			elt.parentNode.removeChild(elt);
		}
		// when opening Browser Window...
		if ((this._showInSidebarMenu || this._showInOrganizerMenu) && 
		    window.location.href == "chrome://browser/content/browser.xul") {
			// XXXhack to add extra menu items to bookmark folders' menu popup
			if (this.fx4) {
				PlacesViewBase.prototype.__onPopupShowing = 
				PlacesViewBase.prototype._onPopupShowing;
				PlacesViewBase.prototype._onPopupShowing = function(aEvent) {
					this.__onPopupShowing.apply(this, arguments);
					FlatBookmarksOverlay.addExtraItems(aEvent);
				};
			}
			else {
				BookmarksEventHandler._onPopupShowing = 
				BookmarksEventHandler.onPopupShowing;
				BookmarksEventHandler.onPopupShowing = function(aEvent) {
					this._onPopupShowing.apply(this, arguments);
					FlatBookmarksOverlay.addExtraItems(aEvent);
				};
			}
		}
		// when opening Library with arguments[1] as itemId, select the given item first
		if ("PlacesOrganizer" in window && window.arguments && window.arguments[1]) {
			PlacesOrganizer._places.selectItems([window.arguments[1]], true);
			PlacesOrganizer._places.focus();
		}
	},

	addExtraItems: function(event) {
		var popup = event.originalTarget;
		if (popup.lastChild.className == "flatbm-extra-item")
			// avoids duplication of extra menu items for same popup
			return;
		if (PlacesUtils.nodeIsTagQuery(this.fx4 ? popup._placesNode : popup._resultNode))
			// don't add extra items if popup is of a tag
			return;
		if (popup.lastChild.className != "openintabs-menuitem")
			popup.appendChild(document.createElement("menuseparator"));
		if (this._showInSidebarMenu) {
			var elt = document.createElement("menuitem");
			elt.className = "flatbm-extra-item";
			elt.setAttribute("label", 
				document.getElementById("flatbmContext_showInSidebar").label
			);
			elt.setAttribute("oncommand", 
				this.fx4 ? "FlatBookmarksOverlay.showInSidebar(this.parentNode._placesNode);"
				         : "FlatBookmarksOverlay.showInSidebar(this.parentNode._resultNode);"
			);
			popup.appendChild(elt);
			// [Mac] don't show icon of extra item
			if (this.mac)
				elt.style.listStyleImage = "none";
		}
		if (this._showInOrganizerMenu) {
			var elt = document.createElement("menuitem");
			elt.className = "flatbm-extra-item";
			elt.setAttribute("label", 
				document.getElementById("flatbmContext_showInOrganizer").label
			);
			elt.setAttribute("oncommand", 
				this.fx4 ? "FlatBookmarksOverlay.showInOrganizer(this.parentNode._placesNode);"
				         : "FlatBookmarksOverlay.showInOrganizer(this.parentNode._resultNode);"
			);
			popup.appendChild(elt);
			// [Mac] don't show icon of extra item
			if (this.mac)
				elt.style.listStyleImage = "none";
		}
	},

	showInSidebar: function(aNode) {
		if (!aNode)
			aNode = PlacesUIUtils.getViewForNode(document.popupNode).selectedNode;
		// this fixes the bug: if selecting 'Show in Sidebar' from the left pane of Library,
		// Bookmarks Sidebar shows folders only without non-folder items
		if (aNode.queryOptions && aNode.queryOptions.excludeItems)
			aNode.queryOptions.excludeItems = false;
		var win = Cc["@mozilla.org/appshell/window-mediator;1"].
		          getService(Ci.nsIWindowMediator).
		          getMostRecentWindow("navigator:browser");
		var sidebar = win.document.getElementById("sidebar");
		const sidebarURI = "chrome://browser/content/bookmarks/bookmarksPanel.xul";
		if (sidebar.getAttribute("src") == sidebarURI) {
			// if Bookmarks Sidebar is opened, change the current folder
			sidebar.contentWindow.FlatBookmarks.goDown(aNode);
		}
		else {
			// otherwise, set place: URI to pref and open Bookmarks Sidebar
			var branch = this.branch;
			branch.setCharPref("place", aNode.uri);
			if (PlacesUtils.nodeIsQuery(aNode) && !PlacesUtils.nodeIsQuery(aNode.parent))
				this.branch.setIntPref("queryItemId", aNode.itemId);
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
		if (win) {
			// if Library is opened, change the current folder
			win.PlacesOrganizer._places.selectItems([aNode.itemId], true);
			win.PlacesOrganizer._places.focus();
			win.setTimeout(function() { win.focus(); }, 0);
		}
		else {
			// otherwise, open Library with argument as itemId
			openDialog("chrome://browser/content/places/places.xul", "", 
			           "chrome,toolbar=yes,dialog=no,resizable", "AllBookmarks", aNode.itemId);
		}
	},

};


window.addEventListener("load", function() { FlatBookmarksOverlay.init(); }, false);


