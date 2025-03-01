var cheerio = require('cheerio');
var Promise = require('bluebird');
var utils = require('../utils');
var Resource = require('../resource');

function loadHtml (context, resource) {
	var sources = context.getHtmlSources();
	var handleResources = loadResources.bind(null, context, resource);

	var p = beforeHandle(resource);

	sources.forEach(function (src) {
		p = p.then(function loadSource () {
			return handleResources(src);
		});
	});
	return p;
}

function beforeHandle (resource) {
	var text = resource.getText();
	var $ = cheerio.load(text);

	// Handle <base> tag
	$('base').each(function () {
		var el = $(this);
		var href = el.attr('href');
		if (href) {
			var newUrl = utils.getUrl(resource.getUrl(), href);
			resource.setUrl(newUrl);
			el.remove();
		}
	});

	text = $.html();
	resource.setText(text);

	return Promise.resolve(resource);
}

function loadResources (context, resource, source) {
	var url = resource.getUrl();
	var text = resource.getText();
	var filename = resource.getFilename();
	var $ = cheerio.load(text);

	var promises = $(source.selector).map(function loadForSelector () {
		var el = $(this);
		var attr = el.attr(source.attr);

		if (attr) {
			var resourceUrl = utils.getUrl(url, attr);
			var htmlResource = new Resource(resourceUrl);
			htmlResource.setParent(resource);
			htmlResource.setHtmlData({ tagName: el[0].name, attributeName: source.attr });

			return context.loadResource(htmlResource).then(function handleLoadedSource (loadedResource) {
				var relativePath = utils.getRelativePath(filename, loadedResource.getFilename());
				el.attr(source.attr, relativePath);
				return Promise.resolve();
			});
		}
		return Promise.reject();
	});

	return utils.waitAllFulfilled(promises).then(function () {
		text = $.html();
		resource.setText(text);
		return resource;
	});
}

module.exports = loadHtml;
