// This file is included in:
//  * History Sidebar
const NHQO = Ci.nsINavHistoryQueryOptions;

var FlatHistory = {

	// nsIPrefBranch
	_branch: null,

	_inSearchMode: false,

	_backHistory: [],

	get dateFormatBundle() {
		const bundleURI = "chrome://global/locale/dateFormat.properties";
		delete this.dateFormatBundle;
		return this.dateFormatBundle = Cc["@mozilla.org/intl/stringbundle;1"].
		                               getService(Ci.nsIStringBundleService).
		                               createBundle(bundleURI);
	},

	init: function() {
		// this fixes the problem that the old style tree appears in an eye's blink (1)
		document.documentElement.collapsed = true;
		this._branch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).
		               getBranch("extensions.flatbm.");
		if (!this._branch.getBoolPref("clickOpensFolder")) {
			// disable opening folder with single click
			window.eval(
				"SidebarUtils.handleTreeClick = " + 
				SidebarUtils.handleTreeClick.toString().replace(
					"tbo.view.toggleOpenState(row.value);", ""
				)
			);
		}
		// hook place change to update parent folders list
		window.eval(
			"gHistoryTree.load = " + 
			gHistoryTree.load.toString().replace(/\}$/, "FlatHistory.onPlaceChange(); }")
		);
		// init search bar
		var label = document.getElementById("sidebar-search-label");
		gSearchBox.setAttribute("emptytext",   label.value.replace(/:$/, ""));	// [Firefox3.6]
		gSearchBox.setAttribute("placeholder", label.value.replace(/:$/, ""));	// [Firefox4]
		gSearchBox.setAttribute("accesskey", label.getAttribute("accesskey"));
		label.hidden = true;
		// init 'View' button
		var viewButton = document.getElementById("viewButton");
		var viewMenu   = document.getElementById("viewMenu");
		viewMenu.appendChild(viewButton.firstChild);
		viewMenu.label = viewButton.label;
		viewButton.hidden = true;
		// [Mac][Firefox4] this fixes the problem: 
		// 'View' button has a blank space without icon since list-style-image is not applied
		if (window.getComputedStyle(viewMenu, null).listStyleImage == "none")
			viewMenu.setAttribute("_noiconic", "true");
		// init 'History' button
		var rootButton = document.getElementById("flatbm-history-button");
		rootButton.label = PlacesUIUtils.getString("OrganizerQueryHistory");
		// init go-up and back buttons
		var buttonSet = this._branch.getIntPref("buttonSet");
		document.getElementById("flatbm-goup").hidden = !(buttonSet & 1);
		document.getElementById("flatbm-back").hidden = !(buttonSet & 2);
		if (!this._branch.getBoolPref("expandSubFolders"))
			document.getElementById("flatbm-folders").removeAttribute("onclick");
		// init tree
		var lastPlaceURI = this._branch.getCharPref("place.history");
		if (lastPlaceURI)
			gHistoryTree.place = lastPlaceURI;
		else
			this.onPlaceChange();
		// this fixes the problem that the old style tree appears in an eye's blink (2)
		document.documentElement.collapsed = false;
		// [Firefox3.6] this fixes the following bug: when Firefox is starting up 
		// with opening History Sidebar, placeholder text does not appear
		// NOTE: do this after setting collapsed of documentElement to false
		gSearchBox.focus();
		gSearchBox.blur();
	},

	onOpenFlatContainer: function(aContainer) {
		// this fixes the problem (???) : 
		// when showing context menu, folder open and close in an eye's blink
		if (document.getElementById("placesContext").state == "open")
			return;
		// this fixes the problem: 
		// click event will occur just after changing the current folder with double-click
		setTimeout(function() { gHistoryTree.place = aContainer.uri; }, 0);
	},

	onPlaceChange: function() {
		// calculate query from place: URI
		var place = gHistoryTree.view.result.root.uri;
		var query = {};
		PlacesUtils.history.queryStringToQueries(place, query, {}, {});
		query = query.value[0];
		this._inSearchMode = query.hasSearchTerms;
		// init day and site buttons
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		groupDay.hidden = true;
		groupSite.hidden = true;
		document.getElementById("flatbm-toolbar").hidden = this._inSearchMode;
		// update day button
		if (query.hasBeginTime && query.hasEndTime) {
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
			// decide appropriate place: URI for date button
			var newQuery = query.clone();
			var newOptions = PlacesUtils.history.getNewQueryOptions();
			newQuery.domainIsHost = false;
			newQuery.domain = null;
			newOptions.sortingMode = NHQO.SORT_BY_TITLE_ASCENDING;
			if (gHistoryGrouping == "dayandsite")
				newOptions.resultType = NHQO.RESULTS_AS_SITE_QUERY;
			var uri = PlacesUtils.history.queriesToQueryString([newQuery], 1, newOptions);
			// update button
			groupDay.hidden = false;
			groupDay.setAttribute("label", label);
			groupDay.setAttribute("uri", uri);
			groupDay.setAttribute("tooltiptext", uri);	// #debug
		}
		// update site button
		if (query.domainIsHost) {
			groupSite.hidden = false;
			groupSite.setAttribute("label", query.domain || PlacesUtils.getString("localhost"));
			groupSite.setAttribute("uri", place);
			groupSite.setAttribute("tooltiptext", place);	// #debug
		}
		// remember the last place: URI
		if (!this._inSearchMode) {
			var lastPlace = this._backHistory.length > 0 ? 
			                this._backHistory[this._backHistory.length - 1] : null;
			if (lastPlace != place)
				this._backHistory.push(place);
		}
		this._updateCommands();
		if (!this._inSearchMode)
			this._branch.setCharPref("place.history", place);
	},

	onGroupingChange: function() {
		// keep only the last one of history and remove others
		this._backHistory = this._backHistory.splice(-1);
		this._updateCommands();
	},

	// expand menu of day group or not
	_expandDayGroup: false,

	generatePopup: function(event) {
		var popup = event.target;
		var query, options;
		if (gHistoryGrouping == "dayandsite" && popup.parentNode.id != "flatbm-group-day") {
			var uri;
			if (popup.parentNode.id == "flatbm-group-site")
				// when populating menu of site button with 'Day and Site' grouping, 
				// get place: URI from day button
				uri = document.getElementById("flatbm-group-day").getAttribute("uri");
			else
				// when populating sub menu of day button with 'Day and Site' grouping...
				// get place: URI from parent sub menu of day button
				uri = popup.parentNode.getAttribute("uri");
			var queriesRef = {}, optionsRef = {};
			PlacesUtils.history.queryStringToQueries(uri, queriesRef, {}, optionsRef);
			query = queriesRef.value[0];
			options = optionsRef.value;
		}
		else {
			// in other cases, generate query which is equivalent to root
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
		this._expandDayGroup = (
			gHistoryGrouping == "dayandsite" && 
			popup.parentNode.id == "flatbm-group-day" && 
			this._branch.getBoolPref("expandSubFolders")
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
		elt.setAttribute("tooltiptext", node.uri);	// #debug
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
		// go next with minimal delay every 50th to avoid freezing
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
		// enable go-up button if not in search mode and not showing root folder
		var canGoUp = !this._inSearchMode && (!groupDay.hidden || !groupSite.hidden);
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

	goUp: function() {
		var groupDay  = document.getElementById("flatbm-group-day");
		var groupSite = document.getElementById("flatbm-group-site");
		if (!groupSite.hidden && !groupDay.hidden)
			// if day and site buttons are both visible, go to day folder
			groupDay.doCommand();
		else
			// otherwise, go to root folder
			document.getElementById("flatbm-history-button").doCommand();
	},

	back: function() {
		if (this._backHistory.length < 2)
			return;
		this._backHistory.pop();
		gHistoryTree.place = this._backHistory.pop();
	},

	onDblClick: function(aEvent) {
		if (aEvent.button != 0)
			return;
		var row = {};
		gHistoryTree.treeBoxObject.getCellAt(aEvent.clientX, aEvent.clientY, row, {}, {});
		if (row.value == -1) {
			// when double-clicking on a blank space of tree...
			var cmd = document.getElementById("flatbmCmd:goUp");
			if (!cmd.hasAttribute("disabled"))
				cmd.doCommand();
		}
	},

};


// XXXhack to initialize 'View' menu instead of 'View' button
window.eval(HistorySidebarInit.toString().replace("viewButton", "viewMenu"));
window.addEventListener("load", function() { FlatHistory.init(); }, false);


