import { Injectable } from '@angular/core';
import QRious from 'qrious';
import jsQR, { QRCode } from 'jsqr';



@Injectable()
export class QRgeomap {


  public static async extractQRgeomapFromImage ( canvas ) {
      // Assuming that "canvas" has an image with a QRgeomap on the upper-right corner:
      // Scans the QR code, REMOVES it from "canvas" and then returns an object with the georeferencing data:
      // { url, originalMapWidth, originalMapHeight, topLeftLat,topLeftLon, bottomRightLat,bottomRightLon, currentMapBottomLon }
      // where:
      // - url is the full URL encoded in the QR code
      // - originalMapWidth,originalMapHeight are the width and height (pixels) of the map that was originally encoded in this QR*.
      // - topLeftLat,topLeftLon: the coordinates (latitude,longitude) of the "top-left" point of the encoded map.
      // - bottomRightLat,bottomRightLon: the coordinates (latitude,longitude) of the "bottom-right" point of the encoded map.
      // - currentMapBottomLat: the latitude of the bottom of canvas**. 
      //
      // * The image may have been rescaled.
      // ** The image may contain addicional information in a "footer" below the map.

      return new Promise( async (resolve, reject) => {

        var ctx=canvas.getContext("2d");
        var w=canvas.width;
        console.log("w",w);
        var h=canvas.height;
        //var maxWH = Math.max(w,h);

        // Calculate the size of the QR: measure the width of the "black and white bars with text QRgeomap" (on top-right corner of the image)

        var overwidth=w/4;
        var overHeaderHeight=3;
        var imgData = ctx.getImageData(w-overwidth,0,overwidth,overHeaderHeight);
        var pix = imgData.data;
        var calculatedWhiteWidth;
        var calculatedBlackWidth;
        var isBlack;
        var x,y,offset;
        var qrWidth=0;
        y=1;
        var B2W;
        // Black to White change is supposed to be at 128, but let's try with 124,128,132 (image could be saved with low quality...)
        for ( B2W=118; B2W<=138; B2W+=4 ) { 
            calculatedWhiteWidth=0;
            calculatedBlackWidth=0;
            isBlack=false;
            for ( x=overwidth-1; x>=0; x-- ) {
                offset=4*(overwidth*y+x);
                var R=pix[offset];
                var G=pix[offset+1];
                var B=pix[offset+2];
                if ( !isBlack ) { // first zone (right white line)
                    if ( R>=B2W && G>=B2W && B>=B2W ) {
                        calculatedWhiteWidth+=1;
                    } else {
                        isBlack=true;
                    }
                }
                if ( isBlack ) { // middle (black zone)
                    if ( !(R>=B2W && G>=B2W && B>=B2W) ) {
                        calculatedBlackWidth+=1;
                    } else { // left white line found --> finish!
                        break;
                    }
                }
            }
            if ( calculatedBlackWidth>0 ) {
                var qw = calculatedBlackWidth + calculatedWhiteWidth*2;
                qrWidth = Math.max(qrWidth,qw);
                console.log({B2W:B2W,qw:qw,qrWidth:qrWidth}); 
            }           
        }
        if ( qrWidth==0 || qrWidth>w || qrWidth>h ) {
            reject("UNABLE TO EXTRACT QR GEOMAP");    
            return;
        }
        var hh = qrWidth * 32/128;

        // Extract QR 
        var qrWidth2=500; 
        var qrcanvas = document.createElement("canvas");
        qrcanvas.width = qrWidth2;
        qrcanvas.height = qrWidth2;
        var ctx1=qrcanvas.getContext("2d");
        ctx1.drawImage(canvas,w-qrWidth,hh,qrWidth,qrWidth, 0,0,qrWidth2,qrWidth2);  

        // Decodify the QR
        try {
            console.log("try to decode QR as is")
            var url:any = QRgeomap.decodeQR(qrcanvas);
            if ( !url ) { // sometimes it's unable to decode the semitransparent QR --> make it black/white
                imgData = ctx1.getImageData(0,0,qrWidth2,qrWidth2);
                pix = imgData.data;
                for ( var i=0,n=pix.length; i<n; i+=4 ) {
                    var gr=(pix[i+0]+pix[i+1]+pix[i+2])/3;
                    if ( gr<128 ) gr=0; else gr=255;
                    pix[i  ]=pix[i+1]=pix[i+2]=gr;
                    }
                ctx1.putImageData(imgData, 0, 0); // now qrcanvas is a normal (black & white) QR
                // Try again
                console.log("try to decode QR converted to B&W");
                url = QRgeomap.decodeQR(qrcanvas);
            }
            console.log("url",url);
            if ( url && url.includes("qrgeomap=") ) {
    
                // Remove QR from original canvas
                var ctx=canvas.getContext("2d");
                var imgData = ctx.getImageData(w-qrWidth,0,qrWidth,hh+qrWidth);
                var pix = imgData.data;
                for ( var i=0,n=pix.length; i<n; i+=4 ) {
                    var gr=(pix[i+0]+pix[i+1]+pix[i+2])/3;
                    pix[i  ] = 2 * (gr<0x80 ? pix[i  ] : (pix[i  ]-0x80));
                    pix[i+1] = 2 * (gr<0x80 ? pix[i+1] : (pix[i+1]-0x80));
                    pix[i+2] = 2 * (gr<0x80 ? pix[i+2] : (pix[i+2]-0x80));
                    }
                ctx.putImageData(imgData, w-qrWidth,0);
    
                // return data (resolve)
                var parts=url.split("qrgeomap=");
                var part1=parts[1];
                var parts2=part1.split("&");
                var qrgeomapParams=parts2[0];
                var params=qrgeomapParams.split("_");
                var originalMapW=Number(params[0]);
                var originalMapH=Number(params[1]);
                var maxLat=Number(params[2]);
                var minLon=Number(params[3]);
                var minLat=Number(params[4]);
                var maxLon=Number(params[5]);

                var rescaleFactor=w/originalMapW;
                var currentMapBottomLat=maxLat-((maxLat-minLat)/originalMapH)*h/rescaleFactor;
    
                const geodata={ url:url, originalMapWidth:originalMapW, originalMapHeight:originalMapH, topLeftLat:maxLat, topLeftLon:minLon, bottomRightLat:minLat, bottomRightLon:maxLon, currentMapBottomLat:currentMapBottomLat };
                resolve( geodata );

            } else {
                reject("UNABLE TO EXTRACT QR GEOMAP");    
            }
    
        } catch (e) {
            console.log(e);
            reject("UNABLE TO EXTRACT QR GEOMAP");
        }

      });

  }
  



  public static async printQRgeomapOnImage ( mapCanvas, mapWidth, mapHeight, topLeftLat,topLeftLon, bottomRightLat,bottomRightLon, baseURL="https://www.qrgeomap.com/" ) {
      // Generates and prints a "QR geomap" for a map image.
      // - 'mapCanvas' is the image (canvas) that contains the map.
      // - 'mapWidth','mapHeight' are the map image dimensions (pixels). NOTE: mapWidth must be equal to canvas.width, but canvas.height can be greater than mapHeight (legend or whatever can be added below the original map image) 
      // - 'topLeftLat','topLeftLon' are the coordinates (geolocation) of the top-left pixel (at 0,0)
      // - 'bottomRightLat','bottomRightLon' are the coordinates (geolocation) of the bottom-right pixel (at mapWidth-1,mapHeight-1)
      // - 'baseURL' (optional) is the base URL to encode before "qrgeomap=...". e.g: http://www.yourdomain.com/whatever/...?param1=value1&... (It defaults to: "https://www.qrgeomap.com/")
      // e.g.: https://www.qrgeomap.com/?qrgeomap=2400_1801_36.776637_-4.7121093_36.7623139_-4.6882708  
   
      return new Promise( (resolve, reject) => { 

          var imageQRgeomap = new Image();  // load the "QRgeomap" header image...
          imageQRgeomap.onload = () => {    // when loaded:

              var mw=mapWidth;
              var mh=mapHeight;
              var mAspect=1.0*mw/mh;
              var w=mapCanvas.width;
              var h=Math.floor(1.0*w/mAspect);
            
              var maxWH = Math.max(w,h);
              var scaleFactor = 1+maxWH/1280;
              var qrWidth = Math.floor(128*scaleFactor);   // qr (and header) width
              var hh = Math.floor(32*scaleFactor);         // header height

              // create new canvas with "QRgeomap" header and the QR
              var hqCanvas = document.createElement("canvas"); 
              hqCanvas.width = qrWidth;
              hqCanvas.height = hh+qrWidth;
              var hqContext = hqCanvas.getContext("2d");
              hqContext.imageSmoothingEnabled = false;
              hqContext.drawImage(imageQRgeomap,0,0,128,32,0,0,qrWidth,hh);
              var url = QRgeomap.generateURLforQRgeomap(w,h,topLeftLat,topLeftLon,bottomRightLat,bottomRightLon,baseURL);
              console.log(url);
              var qrcanvas = QRgeomap.generateQR(qrWidth,url); 
              hqContext.drawImage(qrcanvas,0,0,qrWidth,qrWidth,0,hh,qrWidth,qrWidth);
        
              // Overlay QRgeomap (semitransparent) on map image
              var hqImageData = hqContext.getImageData(0,0,qrWidth,hh+qrWidth);
              var hqPixels = hqImageData.data;
              var mapCanvasCtx = mapCanvas.getContext("2d");
              var mapImageData = mapCanvasCtx.getImageData(w-qrWidth,0,qrWidth,hh+qrWidth);
              var mapPixels = mapImageData.data;
              for ( var i=0,n=mapPixels.length; i<n; i+=4 ) {
                  mapPixels[i  ] = (mapPixels[i  ]>>>1) | (hqPixels[i  ]&0x80); // red
                  mapPixels[i+1] = (mapPixels[i+1]>>>1) | (hqPixels[i+1]&0x80); // green
                  mapPixels[i+2] = (mapPixels[i+2]>>>1) | (hqPixels[i+2]&0x80); // blue
                  // i+3 is alpha (the fourth element)
              }
              mapCanvasCtx.putImageData(mapImageData,w-qrWidth,0);
              
              resolve(true);

          }; //imageQRgeomap.onload 
          imageQRgeomap.src = QRgeomap.QRgeomapHeaderImageBase64();         
      
      }); //Promise      

  } //printQRgeomapOnImage










  // ----------------- private ----------------------------------------------------


  private static QRgeomapHeaderImageBase64 () {
    // the black&white image containing "QR geomap", to be printed above every QR code
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAAgCAIAAABVQOdyAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAEASURBVHja7JnRDoMgDEXt4v//MnsgMQ0QUGgFtnMfB3H1HttSlRDCoSQiB/JUYvgHR+YKAAAAAAIAABAAAIAm6DSfLPKBrrkBAAbuX4bGX0IIicUJknwDJahf2so7tsY9xcwAANqtB3QXrmKu1BuG+arh9bcBUHG/eEv197V9q7oD6T15VI+uvzSA+n1Sgtyln7iRI5Br637/XDChBInICAPv7DEvMm+cgnSUdyLmGGqWAfFxbjYrwzqQrzanbtd/HzXQ3DjzErHOzGwSieM3YQrL/En4YgCGaaegwST9N3LnagGtPKN5xMbLuN/qAQgAAEAAAAACwCb6AgAA//8DAPCanD7wXf4hAAAAAElFTkSuQmCC";
  }



  /*private*/ static decodeQR ( canvas ) {
        // Assuming that canvas contains a QR code, tries to decode it and return the contained text.
        // (returns false if unable to decode QR)

        var ctx=canvas.getContext("2d");
        var w=canvas.width;
        var h=canvas.height;
        var imgData = ctx.getImageData(0,0,w,h);
        const code:QRCode = jsQR(imgData.data, w, h, { inversionAttempts: "dontInvert" });
        if (code) {
            //console.log(code);
            return code.data;
        } else {
            return false;
        }

  }



  private static generateURLforQRgeomap ( imageWidth, imageHeight, topLeftLat,topLeftLon, bottomRightLat,bottomRightLon, baseURL ) {
      // Returns the text (url) to be codified in the QR code. It will return a custom "base url" adding a parameter with the georreferencing 
      var url=baseURL;
      if ( url.includes("?") ) url+="&"; else url+="?";
      url+=`qrgeomap=${imageWidth}_${imageHeight}_${topLeftLat}_${topLeftLon}_${bottomRightLat}_${bottomRightLon}`;
      return url;
  }



  private static generateQR ( sizepx, text ) { 
      // Generates a QR code image (canvas) with "text" encoded in it. The canvas size will be "sizepx" * "sizepx".
      // *** dependencies: QRious
       
      // create new canvas
      var qrcanvas = document.createElement("canvas"); 
      qrcanvas.width = sizepx;
      qrcanvas.height = sizepx;

      // generate the QR (using QRious)
      var qr = new QRious({
          element: qrcanvas,
          value: text,
          background: 'white', // background color
          foreground: 'black', // foreground color
          backgroundAlpha: 1,
          foregroundAlpha: 1,
          level: 'L', // Error correction level of the QR code (L, M, Q, H)
          mime: 'image/png', // MIME type used to render the image for the QR code
          size: sizepx, // Size of the QR code in pixels.
          padding: null // padding in pixels
      });

      return qrcanvas;

  }





}
