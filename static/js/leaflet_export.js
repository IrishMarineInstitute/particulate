(function(L, undefined) {
  L.Map.addInitHook(function () {
    this.whenReady(function () {
      L.Map.mergeOptions({ preferCanvas: true });
      if (!('exportError' in this)) {
        this.exportError = {
          wrongBeginSelector: 'Селектор JQuery не имеет начальной скобки (',
          wrongEndSelector: 'Селектор JQuery не заканчивается скобкой )',
          jqueryNotAvailable: 'В опциях используется JQuery селектор, но JQuery не подключен.Подключите JQuery или используйте DOM-селекторы .class, #id или DOM-элементы',
          popupWindowBlocked: 'Окно печати было заблокировано браузером. Пожалуйста разрешите всплывающие окна на этой странице',
          emptyFilename: 'При выгрузке карты в виде файла не указано его имя'
        };
      }


      this.supportedCanvasMimeTypes = function() {
        if ('_supportedCanvasMimeTypes' in this) {
          return this._supportedCanvasMimeTypes;
        }
        var mimeTypes = {
          PNG:'image/png',
          JPEG: 'image/jpeg',
          JPG: 'image/jpg',
          GIF: 'image/gif',
          BMP: 'image/bmp',
          TIFF: 'image/tiff',
          XICON: 'image/x-icon',
          SVG: 'image/svg+xml',
          WEBP: 'image/webp'
        };
        var canvas = document.createElement('canvas');
        canvas.style.display = 'none';
        canvas = document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'red';
        ctx.fillRect(0,0,1,1);
        this._supportedCanvasMimeTypes = {};
        for (var type in mimeTypes) {
          var mimeType = mimeTypes[type];
          var data = canvas.toDataURL(mimeType);
          var actualType = data.replace(/^data:([^;]*).*/, '$1');
          if (mimeType === actualType) {
            this._supportedCanvasMimeTypes[type] = mimeType;
          }
        }
        document.body.removeChild(canvas);
        return this._supportedCanvasMimeTypes;
      };

      this.export = function(options){
				/* fullergalway copied from https://gist.github.com/chriskoch/366054
				 * draw a multiline string rotated in a canvas
				 *
				 * @param ctx (M) context of the canvas
				 * @param text (M) string may contain \n
				 * @param posX (M) horizontal start position
				 * @param posY (M) vertical start position
				 * @param textColor color
				 * @param rotation in degrees (by 360)
				 * @param font must be installed on client use websafe
				 * @param fonSize in Pixels
				 *
				 * all (M) params are mandatory - rest is optional
				 */
				function drawString(ctx, text, posX, posY, textColor, rotation, font, fontSize) {
					var lines = text.split("\n");
					if (!rotation) rotation = 0;
					if (!font) font = "'serif'";
					if (!fontSize) fontSize = 16;
					if (!textColor) textColor = '#000000';
					ctx.save();
					ctx.font = fontSize + "px " + font;
					ctx.fillStyle = textColor;
					ctx.translate(posX, posY);
					ctx.rotate(rotation * Math.PI / 180);
					for (var i = 0; i < lines.length; i++) {
						ctx.fillText(lines[i],0, i*fontSize);
					}
					ctx.restore();
				}

				/* fullergalway
				 * draw a multiline string on corner of canvas
				 *
				 * @param ctx (M) context of the canvas
				 * @param text (M) string may contain \n
				 * @param gravity(M) topleft, bottomleft, topright, bottomright
				 * @param textColor color
				 * @param font must be installed on client use websafe
				 * @param fonSize in Pixels
				 * @param margin in Pixels
				 *
				 * all (M) params are mandatory - rest is optional
				 */
				function drawStringGravity(ctx, text, gravity, textColor, font, fontSize, margin) {
					var lines = text.split("\n");
					font = font || "'serif'";
					fontSize = fontSize || 16;
					margin = margin || (margin === 0?0:20);
					ctx.save();
					ctx.font = fontSize + "px " + font;
					ctx.fillStyle = textColor;
					var textWidth = 0;
					var textHeight = lines.length * fontSize;
					for (var i = 0; i < lines.length; i++) {
						textWidth = Math.max(textWidth,ctx.measureText(lines[i]).width);
					}
					var width = ctx.canvas.clientWidth || ctx.canvas.width;
					var height = ctx.canvas.clientHeight || ctx.canvas.height
					ctx.restore();
					var posX = margin, posY = margin;
					switch(gravity){
						case 'topright':
							posX = width - textWidth - margin;
							break;
						case 'bottomleft':
							posY = height - textHeight - margin;
							break;
						case 'bottomright':
							posX = width - textWidth - margin;
							posY = height - textHeight - margin;
							break;
					}
					var rotation = 0;
					drawString(ctx, text, posX, posY, textColor, rotation, font, fontSize);
				}

        var caption = {};
        var exclude = [];
        var format ='image/png';
        options = options || { caption: {}, exclude: []};
        if ('caption' in options) {
          caption = options['caption'];
          if ('position' in caption) {
            var position = caption.position;
            if (!Array.isArray(position)) {
              position = [0, 0];
            }
            if (position.length !=2 ) {
              if (position.length === 0){
                position[0] = 0;
              }
              if (position.length === 1 ) {
                position[1] = 0;
              }
            }
            if (typeof position[0] !== 'number') {
              if (typeof position[0] === 'string') {
                position[0] = parseInt(position[0]);
                if (isNaN(position[0])) {
                  position[0] = 0;
                }
              }
            }
            if (typeof position[1] !== 'number') {
              if (typeof position[1] === 'string') {
                position[1] = parseInt(position[1]);
                if (isNaN(position[1])) {
                  position[1] = 0;
                }
              }
            }
            caption.position = position;
          }
        }

        if ('exclude' in options && Array.isArray(options['exclude'])) {
          exclude = options['exclude'];
        }

        if ('format' in options) {
          format = options['format'];
        }

        var afterRender = options.afterRender;
        if (typeof afterRender !== 'function') {
          afterRender = function(result) {return result};
        }

        var afterExport = options.afterExport;
        if (typeof afterExport !== 'function') {
          afterExport = function(result) {return result};
        }

        var container = options.container || this._container;

        var hide = [];
        for (var i = 0; i < exclude.length; i++) {
          var selector = exclude[i];
          switch (typeof selector) {
            case 'object':
              if ('tagName' in selector) {  //DOM element
                hide.push(selector);
              }
              break;
            case 'string':  //selector
              var type = selector.substr(0,1);
              switch (type) {
                case '.': //class selector
                  var elements = container.getElementsByClassName(selector.substr(1));
                  for (var j = 0; j < elements.length; j++) {
                    hide.push(elements.item(j));
                  }
                  break;
                case '#':   //id selector
                  var element = container.getElementById(selector.substr(1));
                  if (element) {
                    hide.push(element);
                  }
                  break;
                case '$': //JQuery
                  var jQuerySelector = selector.trim().substr(1);
                  if (jQuerySelector.substr(0,1) !== '(') {
                    throw new Error(this.exportError.wrongBeginSelector);
                  }
                  jQuerySelector = jQuerySelector.substr(1);
                  if (jQuerySelector.substr(-1) !== ')') {
                    throw new Error(this.exportError.wrongEndSelector);
                  }
                  jQuerySelector = jQuerySelector.substr(0, jQuerySelector.length-1);
                  if (typeof jQuery !== 'undefined') {
                    var elements = $(jQuerySelector, container);
                    for (var j = 0; j < elements.length; j++) {
                      hide.push(elements[i]);
                    }
                  } else {
                    throw new Error(this.exportError.jqueryNotAvailable);
                  }

              }
          }
        }
        for (var i = 0; i < hide.length; i++) { //Hide exclude elements
          hide[i].setAttribute('data-html2canvas-ignore', 'true');
        }
        var _this = this;

        return html2canvas(container, {
          useCORS: true
        }).then(afterRender).then(
        function(canvas) {
          for (var i = 0; i < hide.length; i++) { //Unhide exclude elements
            hide[i].removeAttribute('data-html2canvas-ignore');
          }
          if ('text' in caption && caption.text) {
            var ctx = canvas.getContext('2d');
						drawStringGravity(ctx, caption.text, caption.gravity, caption.fillStyle, caption.font, caption.fontSize, caption.margin);
          }

//           document.body.appendChild(canvas);
          var ret = format === 'canvas' ? canvas : { data:canvas.toDataURL(format), width: canvas.width,  height: canvas.height, type: format};
          return ret;
        }, function(reason) {
          var newReason = reason;
          alert(reason);
        }).then(afterExport)
        ;
      };

      this.printExport = function(options) {
        options = options || {};
        var exportMethod = options.export || this.export;

        var _this = this;
        return exportMethod(options).then(
          function(result) {
            var printWindow = window.open('', '_blank');
            if (printWindow) {
              var printDocument = printWindow.document;
              printDocument.write('<html><head><title>' + (options.text ? options.text : '') + '</title></head><body onload=\'window.print(); window.close();\'></body></html>');
              var img = printDocument.createElement('img');
              img.height = result.height;
              img.width = result.width;
              img.src = result.data;
              printDocument.body.appendChild(img);
              printDocument.close();
              printWindow.focus();
            } else {
              throw new Error(_this.exportError.popupWindowBlocked);
            }

            return result;
          }
        );
      };

      this.downloadExport = function(options) {
        options = options || {};
        if (!('fileName' in options)) {
          throw new Error(this.exportError.emptyFilename);
        }

        var exportMethod = options.export || this.export;
        var fileName = options.fileName;
        delete options.fileName;

        var _this = this;
        return exportMethod(options).then(
          function(result) {
            var fileData = atob(result.data.split(',')[1]);
            var arrayBuffer = new ArrayBuffer(fileData.length);
            var view = new Uint8Array(arrayBuffer);
            for (var i = 0; i < fileData.length; i++) {
              view[i] = fileData.charCodeAt(i) & 0xff;
            }

            var blob;
            if (typeof Blob === 'function') {
              blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            } else {
              var blobBuilder = new (window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder);
              blobBuilder.append(arrayBuffer);
              blob = blobBuilder.getBlob('application/octet-stream');
            }

            if (window.navigator.msSaveOrOpenBlob) {
              // IE не умеет открывать blob и data ссылки, но в нем есть специальный метод для скачивания blob в виде файлов.
              window.navigator.msSaveBlob(blob, fileName);
            } else {
              var blobUrl = (window.URL || window.webkitURL).createObjectURL(blob);
              var downloadLink = document.createElement('a');
              downloadLink.style = 'display: none';
              downloadLink.download = fileName;
              downloadLink.href = blobUrl;
              // Для IE необходимо, чтобы ссылка была добавлена в тело документа.
              document.body.appendChild(downloadLink);
              // Кликаем по ссылке на скачивание изображения.
              downloadLink.click();
              // Удаляем ссылку из тела документа.
              document.body.removeChild(downloadLink);
            }

            return result;
          }
        );
      };
    });
  });

})(L);
