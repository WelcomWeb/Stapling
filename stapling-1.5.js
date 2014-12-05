/*jslint vars:true */
/*global ActiveXObject, DOMParser, XSLTProcessor*/
/**
* Stapling 1.5
*
* JSON XSLT Parser, use XSLT to transform JSON
*
* @author Björn Wikström <bjorn@welcom.se>
* @license LGPL v3 <http://www.gnu.org/licenses/lgpl.html>
* @version 1.5
* @copyright Welcom Web i Göteborg AB 2012
*/
;(function (window, document) {'use strict';
    
    /**
    * If Stapling is already loaded, don't load it again
    */
    if (!!window.Stapling) {
        return;
    }
    
    /**
    * IE7/IE8 doesn't have the Array.indexOf() method
    * nativly, so we manually have to implement it
    */
    Array.prototype.indexOf = Array.prototype.indexOf || function (obj, start) {
        var i;
        for (i = (start || 0); i < this.length; i++) {
            if (this[i] === obj) {
                return i;
            }
        }
        
        return -1;
    
    };

    /**
    * IE7/IE8 and FireFox < 1.5 doesn't have the Array.forEach()
    * method nativly, so we have to add this manually for
    * these broswsers as well
    */
    Array.prototype.forEach = Array.prototype.forEach || function (callback, thisArg) {
        var i;
        for (i = 0; i < this.length; i++) {
            callback.call(thisArg, this[i]);
        }

    };
    
    var Stapling = (function () {
        
        /**
        * Older IE versions handle XML and XSLT throught ActiveX-components,
        * so we need to check if we can use modern functionality or if
        * we have to fall back to ActiveX-components
        */
        var activeXParsing = !(window.DOMParser && window.XSLTProcessor),
            activeXRequest = !window.XMLHttpRequest;
        
        /**
        * The event callback queue
        */
        var _events = {
            'parse': [],
            'request': []
        };

        /**
        * Do an asynchronous Ajax call for a resource,
        * either a XSLT template or a JSON webservice
        *
        * @param url {String} A URI for the resource
        * @param callback {Function} A callback for a successful Ajax call
        * @returns {Void}
        * @throws {Exception} If the resource couldn't be fetched
        */
        var _request = function (url, callback) {

            /* If we have any request events, call them to see
               if we should proceed with the request */
            if (!!_events.request && _events.request.length > 0) {
                var shouldRequest = true;
                _events.request.forEach(function (fn) {
                    if (!fn.call(this, url)) {shouldRequest = false;}
                }, this);

                if (!shouldRequest) {
                    return;
                }
            }

            var request;
            if (activeXRequest) {
                request = new ActiveXObject("Msxml2.XMLHTTP");
            } else {
                request = new XMLHttpRequest();
            }
            
            request.onreadystatechange = function() {
                if (request.readyState === 4 && request.status === 200) {
                
                    callback(request.responseText);
                
                } else if (request.readyState === 4) {
                
                    throw {
                        "type": "ServerException",
                        "message": "The resource could not be fetched from '" + url + "'"
                    };
                
                }
            };
            
            var operator = url.indexOf('?') >= 0 ? '&' : '?';
            var path     = url + operator + 'cache=' + (new Date()).getMilliseconds() + (new Date()).getSeconds();
            
            request.open("GET", path, true);
            request.send("");
        
        };
        
        /**
        * Create a XMLDocument from a XML string
        *
        * @param string {String} The XML in string format
        * @returns {XMLDocument}
        */
        var _xmlFromString = function (string) {
        
            if (!activeXParsing) {
                return (new DOMParser()).parseFromString(string, "text/xml");
            }

            var x = new ActiveXObject("Msxml2.DOMDocument");
            x.loadXML(string);
            
            return x;
        
        };
        
        /**
        * Create a XMLDocument|DOMDocument from a XSL string
        *
        * @param string {String} The XSL in string format
        * @returns {XMLDocument|DOMDocument}
        */
        var _xslFromString = function (string) {
        
            if (!activeXParsing) {
                return (new DOMParser()).parseFromString(string, "text/xml");
            }
            
            var x = new ActiveXObject("Msxml2.FreeThreadedDOMDocument");
            x.loadXML(string);
            
            return x;
        
        };
        
        /**
        * Create a "full" XML-like string
        *
        * @param content {String} The XML content
        * @returns {String}
        */
        var _fullXmlString = function (xmlPart) {
            return '<' + '?xml version="1.0" encoding="UTF-8" ?' + '><json>' + xmlPart + '</json>';
        };
        
        /**
        * Sanitizes a node name from a JSON name, only
        * allow a-z, A-Z, 0-9, - and _
        *
        * @param name {String} The name of the node
        * @returns {String}
        */
        var _sanitize = function (name) {
            return name.replace(/[^a-z0-9\-_]/ig, '');
        };
        
        /**
        * Parse a JavaScript array to a XML node list
        *
        * @param name {String} The name of the node
        * @param elements {Array} The JSON array
        * @returns {Array}
        */
        var _parseList = function (name, elements) {
        
            var i, j, children, list = [];
            
            for (i = 0; i < elements.length; i++) {
            
                /* Is it a regular JavaScript object? */
                if (Object.prototype.toString.call(elements[i]) === '[object Object]') {
            
                    children = _parseObject(elements[i]);
            
                    list.push('<item>');
                    for (j = 0; j < children.length; j++) {
                        list.push(children[j]);
                    }
                    list.push('</item>');
            
                } /* Is it an array? */
                else if (Object.prototype.toString.call(elements[i]) === '[object Array]') {
            
                    children = _parseList('item', elements[i]);
            
                    for (j = 0; j < children.length; j++) {
                        list.push(children[j]);
                    }
            
                } /* It's something that can be translated to a string */
                else {
            
                    list.push('<' + _sanitize(name) + '>' + elements[i] + '</' + _sanitize(name) + '>');
            
                }
            
            }
            
            return list;
        
        };
        
        /**
        * Parse a JavaScript object (not array) to a XML node list
        *
        * @param obj {Object} The container object
        * @returns {Array}
        */
        var _parseObject = function (obj) {
        
            var p, i, children, xmlString, list = [];
            for (p in obj) {
            
                /* Is it a regular JavaScript object? */
                if (Object.prototype.toString.call(obj[p]) === '[object Object]') {
            
                    children = _parseObject(obj[p]);
            
                    xmlString = '<' + _sanitize(p) + '>';
                    for (i = 0; i < children.length; i++) {
                        xmlString += children[i];
                    }
                    xmlString += '</' + _sanitize(p) + '>';
            
                    list.push(xmlString);
            
                } /* Is it an array? */
                else if (Object.prototype.toString.call(obj[p]) === '[object Array]') {
            
                    children = _parseList(p, obj[p]);
            
                    xmlString = '<' + _sanitize(p) + '>';
                    for (i = 0; i < children.length; i++) {
                        xmlString += children[i];
                    }
                    xmlString += '</' + _sanitize(p) + '>';
            
                    list.push(xmlString);
            
                } /* It's something that can be translated to a string */
                else {
            
                    list.push('<' + _sanitize(p) + '>' + obj[p] + '</' + _sanitize(p) + '>');
            
                }
            
            }
            
            return list;
        
        };
        
        /**
        * Helper function to parse JSON -> XML String
        *
        * @param json {Object} Either an array or actual JSON object
        * @returns {String}
        */
        var _xmlFromJSON = function (json) {
        
            json = Object.prototype.toString.call(json) === '[object Object]' ? json : {"list-items": json};
            
            var i, children = _parseObject(json),
            content  = '';
            
            for (i = 0; i < children.length; i++) {
                content += children[i];
            }
            
            var xml = _fullXmlString(content);
            return xml;
        
        };
        
        /**
        * Parse a XMLDocument through a XSLT template
        *
        * @param xsl {XMLDocument} The XSLT as a XMLDocument
        * @param xml {XMLDocument} The JSON as a XMLDocument
        * @param callback {Function} Called and supplied with the generated document
        * @returns {Void}
        */
        var _parse = function (xmlDocument, xslDocument, callback) {
        
            var processor, result = false;
            
            if (activeXParsing) {
            
                var template = new ActiveXObject("Msxml2.XSLTemplate");
                template.stylesheet = xslDocument;
                
                processor = template.createProcessor();
                processor.input = xmlDocument;
                processor.transform();
                
                var fragment = document.createDocumentFragment();
                var container = document.createElement('div');
                
                fragment.appendChild(container);
                container.outerHTML = processor.output;
                
                result = fragment;
            
            } else {
            
                processor = new XSLTProcessor();
                processor.importStylesheet(xslDocument);
            
                result = processor.transformToFragment(xmlDocument, document);
            
            }
            
            callback.call(result, xmlDocument);
        
        };
        
        /**
        * Store a resousource, as a string, for the specified resource URI
        *
        * @param name {String} The name (url) of the resource
        * @param content {String} The content of the resource
        * @returns {Void}
        */
        var _store = function (name, content) {
        
            try {
            
                localStorage.setItem(name, content);
            
            } catch (ignore) {}
        
        };
        
        /**
        * See if the resource is in the cache, if so - return it. This
        * will optimize the application as all templates don't need to
        * be fetched on every visit
        *
        * @param name {String} The name (url) of the resource
        * @returns {Mixed} Either the cached resource (as string) or 'false' if not present
        */
        var _retrieve = function (name) {
        
            try {
                return localStorage.getItem(name);

            } catch (e) {return false;}
        
        };
        
        return {
            
            /**
            * Should the next resource be cachable? Either a JSON
            * webservice call or a XSLT template resource
            */
            cachable: true,
            
            /**
            * Helper to see if the client is a relatively modern
            * browser (IE8+) or is using fallback libraries
            *
            * @returns {Boolean}
            */
            isSupported: function () {
            
                return (window.localStorage && window.JSON);
            
            },
            
            /**
            * Pre fetch either a XSLT template from resource
            * or JSON data from service and store it in cache.
            * This way loading content later will be much faster.
            *
            * @param resources {Array|String} The service or template URI(s)
            * @returns {Void}
            */
            prefetch: function (resources) {
                var i;
                if (typeof resources === 'string') {
                    resources = [resources];
                }
            
                for (i = 0; i < resources.length; i++) {
            
                    (function (resource) {
                        _request(resource, function (response) {
            
                            _store(resource, response);
            
                        });
                    }(resources[i]));
            
                }
            
            },
            
            /**
            * Is the specified resource cached?
            *
            * @param resource {String} The service or template URI
            * @returns {Boolean}
            */
            isCached: function (resource) {
            
                return _retrieve(resource) !== false;
            
            },
            
            /**
            * Parse the specified JSON object with a XSLT template
            * from the specified resource
            *
            * @param json {Object} A JSON object
            * @param template {String} An URI to the XSLT template
            * @param callback {Function} Called when done, with the generated document
            * @returns {Void}
            */
            parse: function (json, template, callback) {

                /* If we have any parse events, call them to see
                   if we should proceed with the parsing */
                if (!!_events.parse && _events.parse.length > 0) {
                    var shouldParse = true;
                    _events.parse.forEach(function (fn) {
                        if (!fn.call(this, json, template)) {shouldParse = false;}
                    }, this);

                    if (!shouldParse) {
                        return;
                    }
                }
            
                var xmlDocument, xslDocument,
                    xml    = _xmlFromJSON(json),
                    cached = false;

                if (this.cachable && (cached = _retrieve(template)) !== false && cached != null) {
                
                    xmlDocument = _xmlFromString(xml);
                    xslDocument = _xslFromString(cached);
                
                    _parse(xmlDocument, xslDocument, callback);
                
                } else {
                
                    var me = this;
                    _request(template, function (xsl) {
                
                        if (me.cachable) {
                            _store(template, xsl);
                        }

                        xmlDocument = _xmlFromString(xml);
                        xslDocument = _xslFromString(xsl);
                
                        _parse(xmlDocument, xslDocument, callback);
                
                    });
                
                }
            
            },
            
            /**
            * Load both JSON and XSLT template from resources
            *
            * @param service {String} An URI to the JSON webservice
            * @param template {String} An URI to the XSLT template
            * @param callback {Function} Called when done, with the generated document
            * @returns {Void}
            */
            load: function (service, template, callback) {
            
                var cached = false,
                    me     = this;
                
                if (this.cachable && (cached = _retrieve(service)) !== false && cached != null) {
                
                    me.parse(JSON.parse(cached), template, callback);
                
                } else {
                
                    _request(service, function (json) {
                    
                        if (me.cachable) {
                            _store(service, json);
                        }
                    
                        me.parse(JSON.parse(json), template, callback);
                    
                    });
                
                }
            
            },
            
            /**
            * Clear the cache for the specified resource(s)
            *
            * @param name {String|Array} An URI for a XSLT template, or a list of multiple URIs
            * @returns {Void}
            */
            clear: function (name) {
                var i;
                try {
                    if (Object.prototype.toString.call(name) === '[object Array]') {
                        for (i = 0; i < name.length; i++) {
                            localStorage.removeItem(name[i]);
                        }
                    } else {
                        localStorage.removeItem(name);
                    }
                } catch (ignore) {}
            
            },

            /**
            * Event registration, adds a callback for a supported event
            *
            * @param event {String} An event name
            * @param callback {Function} A callback for the event
            * @returns {Void}
            */
            on: function (event, callback) {
                if (!!_events[event]) {
                    _events[event].push(callback);
                }
            }
        
        };
    
    }());
    
    /**
    * Add Stapling to the global namespace
    */
    window.Stapling = Stapling;

}(window, document));
