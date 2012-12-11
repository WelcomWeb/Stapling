# Stapling, parsing JSON with XSLT
**Stapling is a JavaScript library that enables XSLT formatting for JSON objects.**

## About
Instead of using a JavaScript templating engine and `text/html` templates, Stapling gives you the opportunity to use XSLT templates - loaded asynchronously with Ajax and then cached client side - to parse your JSON datasources. By using XSLT you are using a uniformed language with a W3C specification, available to render the same output on both server side and client side using the same templates - compared to all different JavaScript templating engines that uses their own template markup.

The library is tested in:

* Firefox 10, 11, 12
* Chrome 17, 18
* IE 8, IE 9
* Safari 5
* Opera 11

IE 7 is supported if JSON (https://github.com/douglascrockford/JSON-js) is available, as well as a localStorage fallback (https://github.com/marcuswestin/store.js).

## Examples
<a href="Stapling/tree/master/examples">See the example files</a>

Happy coding!
