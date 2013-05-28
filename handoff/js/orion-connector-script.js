/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global define require console URL window*/
/*jslint browser:true*/ 
var ORION_HOME = 'https://orion.eclipse.org';

define([ORION_HOME + '/import/trampoline.js', 'orion/xhr', 'orion/Deferred', 'orion/URITemplate', 'orion/URL-shim', 'domReady!'],
		function(orionConnector, xhr, Deferred, URITemplate, _, document) {
	var FILE_TO_EDIT = 'README.md';

	function debug(msg) {
		if (console) {
			console.log(msg);
		}
	}

	function logError(err) {
		var msg = err;
		if (typeof err === 'string') {
			try {msg = JSON.parse(err); } catch (e) {}
		} else if (err && err.Message) {
			msg = err.Message;
		}
		debug(msg);
		var output = document.getElementById("output");
		if (output) {
			output.textContent = msg;
		}
	}

	function readPageParams(href) {
		var locationURL = new URL(href), query = locationURL.query;
		if (!query) {
			throw new Error("Couldn't parse URL: " + locationURL.href);
		}
		var appName = query.get('appName'), //$NON-NLS-0$
		    url = query.get('url'); //$NON-NLS-0$
		if (!appName || !url) {
			throw new Error("Missing query parameter");
		}
		return {
			appName: appName,
			url: url
		};
	}

	/**
	 * @param {String} params.appName
	 * @param {String} params.url
	 */
	function downloadApp(params) {
		var baseURL = params.url, appName = params.appName;
		var appDownloadURL = baseURL + (new URITemplate('/download/{appName}.zip').expand({ appName: appName }));
		// Any Cookies required to download app better already be set, or this whole approach fails.
		return xhr('GET', appDownloadURL, {
			responseType: 'arraybuffer'
		}).then(function(xhrResult) {
			return {
				appName: appName,
				zip: xhrResult.response
			};
		}, function(xhrResult) {
			return null;
		});
	}

	function importComplete(event) {
		logError("Redirecting to Orion");
		var redirectToOrion = function(data) {
			var project = data.project, templates = data.templates;
			var appjs, href;
			project.Children.some(function(child) {
				return (child.Name === FILE_TO_EDIT) ? !!(appjs = child) : false;
			});
			if (appjs && appjs.Location) {
				href = new URITemplate(templates.edit).expand({
					Location: decodeURIComponent(appjs.Location)
				});
			} else {
				// Couldn't find the file so just view the project
				href = new URITemplate(templates.navigate).expand({
					Location: decodeURIComponent(project.Location)
				});
			}
			window.location = href;
		};
		var type = event.data.type;
		if (type === 'success') { //$NON-NLS-0$
			redirectToOrion(event.data);
		} else {
		    window.location = event.data.templates.navigate;
		}
	}

	// Init
	logError("Beginning import");
	var pageParams = readPageParams(window.location.href);
	var orionImporterReady = new Deferred();
	orionConnector.addEventListener('ready', function(event) { //$NON-NLS-0$
		orionImporterReady.resolve(event.importer);
	});
	Deferred.all([orionImporterReady, downloadApp(pageParams)], logError /*optOnError*/).then(function(results) {
		var orionImporter = results[0];
		var appData = results[1];
		if (!appData) {
			logError('Could not download app');
			return;
		}
		debug('importing app (' + appData.zip.byteLength + ' bytes) into Orion');

		orionImporter.addEventListener('response', importComplete);
		orionImporter.import({ //$NON-NLS-0$
			type: 'import', //$NON-NLS-0$
			projectName: appData.appName,
			zip: appData.zip
		});
	}, logError);
});