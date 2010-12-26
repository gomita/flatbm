var PrefsUI = {

	changed: false,

	_element: function(aEltId) {
		return document.getElementById(aEltId);
	},

	readButtonSet: function(aTarget) {
		var val = this._element("buttonSet").value;
		switch (aTarget.id) {
			case "buttonSet_goup": return val & 1;
			case "buttonSet_back": return val & 2;
		}
	},

	writeButtonSet: function() {
		var val = 0;
		if (this._element("buttonSet_goup").checked) val |= 1;
		if (this._element("buttonSet_back").checked) val |= 2;
		return val;
	},

	done: function() {
		if (!this.changed)
			return;
		// すべてのブラウザウィンドウのブックマークサイドバーまたは履歴サイドバーをリロード
		const bookmarksPanelURI = "chrome://browser/content/bookmarks/bookmarksPanel.xul";
		const historyPanelURI   = "chrome://browser/content/history/history-panel.xul";
		var winMed = Components.classes["@mozilla.org/appshell/window-mediator;1"].
		             getService(Components.interfaces.nsIWindowMediator);
		var winEnum = winMed.getEnumerator("navigator:browser");
		while (winEnum.hasMoreElements()) {
			var win = winEnum.getNext();
			var sidebar = win.document.getElementById("sidebar");
			var sidebarURI = sidebar.getAttribute("src");
			if (sidebarURI == bookmarksPanelURI || sidebarURI == historyPanelURI)
				sidebar.contentWindow.location.reload();
		}
	}

};


