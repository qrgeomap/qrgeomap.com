import { Component, OnInit, ViewChild } from '@angular/core';
import { Control } from '../services/control';
import gpxParser from 'gpxparser';
import { QRgeomap } from '../services/qrgeomap';
import { IonAccordionGroup } from '@ionic/angular';

@Component({
  selector: 'app-create-map',
  templateUrl: './create-map.page.html',
  styleUrls: ['./create-map.page.scss'],
})
export class CreateMapPage implements OnInit {


  // Published maps API
  QRGEOMAP_HOSTING_API_URL = "https://www.wandapps.com/_qrgeomap_hosting/index.php";  // NOTE: Only accepts uploads from https://www.qrgeomap.com !


  // The dimensions (pixels) of the map to be generated 
  MAP_WIDTH_PIXELS =  2560;
  MAP_HEIGHT_PIXELS = 1792;  


  // Variables for user selections
  map_provider="openstreetmap";
  source_link="";
  color="#000000";
  line_width=2;
  map_title="";



  // aux vars

  track=null;                   // object with the loaded (parsed) track
  track_loaded=false;           // true after the GPX file is loaded
  canvas;                       // the canvas for the final map (including the track, qr, footer...)
  mapCanvas=null;               // aux canvas with the map data (only!)
  got_map=false;                // true after map tiles are downloaded
  imageSrc="";                  // the image that will be shown on screen ( canvas.toDataURL() )
  mData;                        // aux object with data needed to create the map: bounds, ...
  mapReady=false;               // true when the map is ready to be downloaded
  publishData=null;             // aux object with data about the published map 

  points=[];                    // array with points to be painted (start,waypoints,finish)



  // Selectable colors 
  colors = ["#606060","#000000","#0000C0","#0040F0","#F000F0","#B000B0","#B00000","#F00000","#F05000","#008000"];
  
  setColor ( color ) {
      // selects a color
      this.color=color;
  }

  colorStyle ( color ) {
      // returns the style to apply to a selectable color <div>. Different style if "color" is the current selected color
      return {background:color,border:(this.color==color?"0":"4px solid #ffffff")}
  }


  constructor(public control:Control) { } 

  @ViewChild('accordionGroup', { static: true }) accordionGroup: IonAccordionGroup;

  setStep(number) {
      setTimeout(()=>{
            this.accordionGroup.value = ""+number;
      },1000);  
  }


  ngOnInit() {
    // First step
    this.setStep(1);
  }


  onTrackFileSelected ( evt ) { 
        // Fires when the user has selected a file to be loaded --> Checks the extension (GPX) and tries to load and parse the track file

        var tgt = evt.target || window.event.srcElement,
        files = tgt.files;
        if ( FileReader && files && files.length>0 ) {
            var file=files[0];
            if ( !this.control.checkFileExtensionGPX(file.name) ) {
                this.control.alert("ERROR","INVALID FILE");
                return;
            }
            // Load the track file
            var fr = new FileReader();
            fr.onload = ()=>{
                this.clearAll();
                var content = fr.result;
                var data = { name:file.name, content:content };
                var track = this.parseGpxString(data.content);     // parses the track file
                if ( track!=false ) {
                    this.track_loaded=true;
                    this.track=track;                           // parsed track object
                    this.track.filename=data.name;              // filename
                    // Points: start, wayponts, finish
                    this.points=[];
                    var n=this.track.points.length;
                    var p;
                    if ( n>0 ) {
                        p = this.track.points[0];
                        this.points.push({lat:p.lat,lon:p.lon,name:this.control.getString("START"),visible:true});
                    }
                    for ( var i=0; i<this.track.waypoints.length; i++ ) {
                        p=this.track.waypoints[i];
                        this.points.push({lat:p.lat,lon:p.lon,name:p.name,visible:true});
                    } 
                    if ( n>0 ) {
                        p = this.track.points[n-1];
                        this.points.push({lat:p.lat,lon:p.lon,name:this.control.getString("FINISH"),visible:true});
                    }
                    // Suggested title: filename (distance, elevation gain)
                    this.map_title = this.control.removeExtension(track.filename) + " (" + Math.floor(this.track.total_distance/100)/10+ "Km ^" + this.track.cumulative_elevation_gain + "m)";
                    // Next step
                    this.setStep(2);
                } else {
                    this.control.alert("ERROR","UNABLE TO PARSE TRACK FILE");
                }
            }
            fr.readAsText(file);
        }

  }


  clearAll() {
      // Clears all the data to start map creation
      this.track=null;
      this.track_loaded=false;
      this.imageSrc="";
      this.canvas=null;
      this.mapCanvas=null;
      this.got_map=false;
      this.mapReady=false;
      this.map_title="";
      this.source_link="https://www.qrgeomap.com";
      this.publishData=null;
  }



  onChangeMapProvider() {
      // Fires when the user selects another map provider --> clears the map (force user to create again)
      this.imageSrc="";       
      this.mapCanvas=null;    
      this.mapReady=false;  
      this.publishData=null;  
  }


  parseGpxString ( gpxString ) {
        // parses a GPX file content (gpxString) and returns an object with its points and waypoints arrays
        // (returns false if unable to parse)

        var track:any={};
        track.gpxString=gpxString;
        var s=track.gpxString;

        // remove metadata (some tracks with links in metadata fail parsing!)
        var s1 = s.split("<metadata>");
        if ( s1.length==2 ) {
            var s2 = s1[1].split("</metadata>");    
            if ( s2.length==2 ) {
                s=s1[0]+s2[1];
            }
        }
        var gpx = new gpxParser();
        gpx.parse(s);               // parse the gpx file (without metadata)
        console.log(gpx);

        // extract points of the track (first track) and waypoints
        if ( (gpx.tracks && gpx.tracks.length>0) || (gpx.waypoints && gpx.waypoints.length>0) ) { 
            track.points = [];
            track.waypoints = [];
            if ( gpx.tracks[0] ) {
                track.points = gpx.tracks[0].points;
                track.total_distance = Math.floor(gpx.tracks[0].distance.total);            // Total distance (m)
                track.cumulative_elevation_gain = Math.floor(gpx.tracks[0].elevation.pos);  // cumulative elevation gain (m)
            }
            if ( gpx.waypoints ) track.waypoints = gpx.waypoints;
            return track;
        } else {
            return false;
        }

  }



  getMap () {
        // Fires when the user taps the "Get Map" button --> get map tiles...

        if ( (this.track.points.length+this.track.waypoints.length)<2 ) {  // At least 2 points required
            this.control.alert("ERROR","INVALID FILE");
            return;
        }

        // RESOLUTION OF THE MAP 
        let width=this.MAP_WIDTH_PIXELS;
        let height=this.MAP_HEIGHT_PIXELS;  

        // Calculate the bounds of the track (minLat,minLon,maxLat,maxLon)
        var minLat,minLon,maxLat,maxLon;
        var np=0;
        for ( var i=0; i<this.track.points.length; i++ ) { // points
            var p = this.track.points[i];
            var lon=p.lon;
            var lat=p.lat;
            if ( np==0 ) {
                minLat=lat; maxLat=lat; minLon=lon; maxLon=lon;
            } else {
                if ( lat<minLat ) minLat=lat;
                if ( lat>maxLat ) maxLat=lat;
                if ( lon<minLon ) minLon=lon;
                if ( lon>maxLon ) maxLon=lon;
            }
            np++;
        }  
        for ( var i=0; i<this.track.waypoints.length; i++ ) { // waypoints
            var p = this.track.waypoints[i];
            var lon=p.lon;
            var lat=p.lat;
            if ( np==0 ) {
                minLat=lat; maxLat=lat; minLon=lon; maxLon=lon;
            } else {
                if ( lat<minLat ) minLat=lat;
                if ( lat>maxLat ) maxLat=lat;
                if ( lon<minLon ) minLon=lon;
                if ( lon>maxLon ) maxLon=lon;
            }
            np++;
        }  

        // Calculate the coordinates of the map rectangular area to download (rectangle with width/height aspect that completely includes the track points)

        var imgAspectR = 1.0*width/height;
        var trackWidthKms = this.distance(minLat,minLon,minLat,maxLon);
        var kmsPerGradX = trackWidthKms / (maxLon-minLon); 
        var trackHeightKms = this.distance(minLat,minLon,maxLat,minLon);
        var kmsPerGradY = trackHeightKms / (maxLat-minLat); 
        var trackAspectR = trackWidthKms/trackHeightKms;            // aspect ratio of the track points bounds
        var trackCenterLat=(minLat+maxLat)/2;                       // track center
        var trackCenterLon=(minLon+maxLon)/2;
        var factorAmpl=1.20;                                        //  larger factor (a bit of space to the edges)

        var w,h;
        var p1,p2;
        var mapWidthKms,mapHeightKms;
        var properMapFound:boolean=false;

        while ( !properMapFound ) {

            if ( trackAspectR>=imgAspectR ) {               // adjust in width, then height proportionally will be within
                w=(maxLon-minLon)*factorAmpl;
                mapWidthKms = trackWidthKms * factorAmpl;
                mapHeightKms = mapWidthKms/imgAspectR;
                h=mapHeightKms/kmsPerGradY;
            } else {                                        // adjust in height
                h=(maxLat-minLat)*factorAmpl;
                mapHeightKms = trackHeightKms * factorAmpl;
                mapWidthKms = mapHeightKms*imgAspectR;
                w=mapWidthKms/kmsPerGradX;
            }
            p1=[ trackCenterLon-w/2, trackCenterLat+h/2];   // top-left point
            p2=[ trackCenterLon+w/2, trackCenterLat-h/2];   // bottom-right point

            // Find the optimal zoom level for the map (first that exceeds the desired width in pixels)
            for ( var i=7; i<=20; i++ ) {
                var z=i;
                //console.log("z",z);
                var tile_x1=this.long2tile(p1[0],z); 
                var tile_y1=this.lat2tile(p1[1],z); 
                var tile_x2=this.long2tile(p2[0],z); 
                var tile_y2=this.lat2tile(p2[1],z); 
                var numMosaicsX=tile_x2-tile_x1+1;
                var numMosaicsY=tile_y2-tile_y1+1;
                var offsetX=this.long2pixelInTile(p1[0],z);
                var offsetY=this.lat2pixelInTile(p1[1],z);
                var mapWidthPx = 256-offsetX + 256*(numMosaicsX-2) + this.long2pixelInTile(p2[0],z);
                var mapHeightPx = 256-offsetY + 256*(numMosaicsY-2) + this.lat2pixelInTile(p2[1],z);
                var lon1 = this.tile2long(tile_x1,z);
                var lon2 = this.tile2long(tile_x1+1,z);
                var metersPerPixel = Math.floor(this.distance(p1[1],lon1,p1[1],lon2)*1000/256);
                //console.log("mapWidthPx",mapWidthPx);
                if ( mapWidthPx>=width/2 ) {
                    this.mData={zoomLevel:z, mapWidthPx:mapWidthPx, mapHeightPx:mapHeightPx, metersPerPixel:metersPerPixel, tile_x1:tile_x1, tile_x2:tile_x2, tile_y1:tile_y1, tile_y2:tile_y2, offsetX:offsetX, offsetY:offsetY  };
                    properMapFound = true;
                    break;
                }
            }

            factorAmpl = factorAmpl + 0.1;  // Try a wider map...
    
        }//while

        // More map data
        this.mData.p1=p1;
        this.mData.p2=p2;
        this.mData.mapWidthKms = mapWidthKms;
        this.mData.mapHeightKms = mapHeightKms;
        this.mData.width = width;
        this.mData.height = height;
        //console.log(this.mData);


        // CREATE THE MAP (DOWNLOAD TILES...)
        this.got_map=false;
        this.mapCanvas = document.createElement("canvas");
        this.mapCanvas.width = this.mData.width;
        this.mapCanvas.height = this.mData.height;
        this.mData.canvasPixFactor = 1.0 * this.mapCanvas.width / this.mData.mapWidthPx;   
        this.getTile( this.mData.tile_x1,this.mData.tile_y1 ); // get the first tile (then second...)

  }


  getTile( x,y,layer=0 ) {
        // Downloads tile (x,y) and then the next one... 
        // ( if it was the last one --> run whenAllTilesDrawn )

        var z=this.mData.zoomLevel;
        var imgsrc;
        var has2layers=false;
        switch ( this.map_provider ) {
            case "mapbox_satellite+outdoors":
                has2layers=true;
                var t=(layer==0)?"satellite":"outdoors";
                imgsrc=`https://www.wandapps.com/_qrgeomap_tiles/tiles_proxy.php?t=${t}&z=${z}&x=${x}&y=${y}`;
                break;
            case "mapbox_outdoors":
                imgsrc=`https://www.wandapps.com/_qrgeomap_tiles/tiles_proxy.php?t=outdoors&z=${z}&x=${x}&y=${y}`;
                break;
            case "mapbox_satellite":
                imgsrc=`https://www.wandapps.com/_qrgeomap_tiles/tiles_proxy.php?t=satellite&z=${z}&x=${x}&y=${y}`;
                break;
            case "cyclosm":
                imgsrc="https://a.tile-cyclosm.openstreetmap.fr/cyclosm/"+z+"/"+x+"/"+y+".png";
                break;
            case "opentopomap":
                imgsrc="https://a.tile.opentopomap.org/"+z+"/"+x+"/"+y+".png";
                break;
            default:
                imgsrc="https://a.tile.openstreetmap.org/"+z+"/"+x+"/"+y+".png";
                break;    
        }

        var img=new Image();
        img.setAttribute('crossOrigin', 'anonymous'); 
        img.onload = () => {
            // draw on canvas
            var ctx = this.mapCanvas.getContext('2d');
            var f=this.mData.canvasPixFactor;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            var tile_img=null;
            if ( layer==0 ) {
                ctx.globalAlpha = 1;
                tile_img=img;
            } else { // layer==1
                ctx.globalAlpha = 0.5; // semitransparent
                // Optimize levels
                var c = document.createElement("canvas"); c.width=256; c.height=256; 
                var ct=c.getContext('2d'); 
                ct.drawImage(img,0,0);
                var imgData = ct.getImageData(0,0,256,256);
                var pix = imgData.data;
                for ( var i=0,n=pix.length; i<n; i+=4 ) this.changeBrightnessContrast(pix,i,-75,+150);
                ct.putImageData(imgData,0,0);
                tile_img=c;
            }
            ctx.drawImage(tile_img, f*(256*(x-this.mData.tile_x1)-this.mData.offsetX), f*(256*(y-this.mData.tile_y1)-this.mData.offsetY), f*256,f*256);
            // refresh screen
            this.imageSrc = this.mapCanvas.toDataURL();     
            // Next layer / Next tile / Finished ?
            if ( has2layers && layer==0 ) { 
                this.getTile(x,y,1); // Get the second layer
                return;
            }
            if ( y<this.mData.tile_y2 ) { // next row
                this.getTile(x,y+1);
            } else { // next column
                if ( x<this.mData.tile_x2 ) {
                    this.getTile(x+1,this.mData.tile_y1);   // get next tile
                } else {
                    // Finished! All tiles downloaded
                    this.got_map=true;
                    // Next step
                    this.setStep(3);
                }
            }
        };
        // Request the tile
        img.src = imgsrc;

  }


    private changeBrightnessContrast ( pix,i, brightness, contrast ) {
        var r=pix[i+0];
        var g=pix[i+1];
        var b=pix[i+2];
        r=this.truncate(r+brightness);
        g=this.truncate(g+brightness);
        b=this.truncate(b+brightness);
        var factor=(259*(contrast+255))/(255*(259-contrast));
        r=this.truncate(factor*(r-128)+128);
        g=this.truncate(factor*(g-128)+128);
        b=this.truncate(factor*(b-128)+128);
        pix[i+0]=r;
        pix[i+1]=g;
        pix[i+2]=b;
    }

    private truncate(value) {
        if (value<0) return 0;
        if (value>255) return 255;
        return value;
    }


  source_link_in_qr=""; 

  async redrawMap( whenFinishedFunction=null ) {
      // Refreshes the map: base map tiles + track + waypoints + scale + QR + footer (title + attributtion)

        this.publishData=null;

        var mw=this.mData.mapWidthPx;
        var mh=this.mData.mapHeightPx;
        var mAspect=1.0*mw/mh;
        var w=this.mapCanvas.width;
        var h=w/mAspect;
        var font_size=this.baseFontSize();
        console.log(w);
        console.log(h);

        // Create the final canvas (with map and footer)
        var mapBottomY=h;
        var titleH=0; if ( this.map_title && this.map_title.trim().length>0 ) titleH=Math.floor(1.5*font_size);
        h=mapBottomY+titleH+3.6*this.baseFontSize();        // new height adding blank footer
        this.canvas = document.createElement("canvas");     
        this.canvas.width = w;
        this.canvas.height = h;
        var ctx = this.canvas.getContext("2d"); 
        ctx.fillStyle="#f4f4f4";    // footer color
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(this.mapCanvas,0,0);


        // Attibution (inside map; bottom-right)
        var map_attribution;
        map_attribution = "© OpenStreetMap contributors";
        if ( this.map_provider==='opentopomap' ) map_attribution = "Data: © OpenStreetMap contributors, SRTM | Display: © OpenTopoMap (CC-BY-SA)";
        if ( this.map_provider==='cyclosm' ) map_attribution = "Data: © OpenStreetMap contributors | Style: CyclOSM";
        if ( this.map_provider.startsWith('mapbox_') ) map_attribution = "© Mapbox © OpenStreetMap"
        var txt=" "+map_attribution;
        ctx.font = font_size+"px Arial";
        var tw=ctx.measureText(txt).width;
        var th=font_size;
        ctx.fillStyle="rgba(255,255,255,0.33)";
        var pd=font_size/2;
        ctx.fillRect(w-tw-2*pd,mapBottomY-th-3*pd,tw+2*pd,th+3*pd);
        ctx.fillStyle="rgba(0,0,0,0.75)";
        ctx.fillText(txt,w-tw-pd,mapBottomY-th+2);

        // Line (map/footer separator)
        ctx.fillStyle="rgba(0,0,0,0.25)";
        ctx.fillRect(0,mapBottomY-1,w,1);

        var padding_left = font_size*0.75;

        // Mapbox logo ?
        var logoOnLeft = this.map_provider.startsWith('mapbox_');
        if ( logoOnLeft ) {
            var imgLogo:any=await this.control.getImgAsync("/assets/mapbox-logo-white.svg");
            var asp = imgLogo.height / imgLogo.width;
            var lw = 200;
            var lh = lw * asp;
            var lx = padding_left;
            var ly = mapBottomY-padding_left-lh;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0,0,0,0.99)';  
            ctx.drawImage(imgLogo,lx,ly,lw,lh);            
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // Map Scale
        var kmsPerPixel=1.0*this.mData.mapWidthKms/w;
        var sw=1.0/kmsPerPixel;
        var stxt="1 Km";
        if ( sw<50 ) {
                sw=sw*5;
                stxt="5 Km";
        } else if (sw>150) {
                sw=sw/2;
                stxt="500 m";
                if (sw>150) {
                    sw=sw/2;
                    stxt="250 m";
                    if (sw>200) {
                        sw=sw/2.5;
                        stxt="100 m";
                        /*
                        if (sw>150) {
                            sw=sw/2;
                            stxt="50 m";
                        }
                        */
                    }
                }
        }
        ctx.fillStyle="rgba(0,0,0,0.4)";
        ctx.font = font_size+"px Arial";
        var padding_escala=font_size/2;
        var sh=font_size+2*padding_escala;
        var sx=padding_left;                                // scale: on the left
        var sy=mapBottomY-sh-padding_left;                  // bottom
        if ( logoOnLeft ) sx=(w-sw)/2;                      // but if logo is on the left --> scale is centered!
        ctx.fillRect(sx,sy, sw,sh);
        ctx.fillStyle="rgba(255,255,255,0.6)";
        const lineWidth = ctx.measureText(stxt).width;
        const lineHeight = ctx.measureText('M').width; // trick
        ctx.fillText(stxt,sx+(sw-lineWidth)/2,sy+(sh+lineHeight)/2); 

        // Footer: Map Title and Attribution
        var x=font_size;
        var y=mapBottomY+font_size*0.8;
        if ( titleH>0 ) {
            ctx.fillStyle="rgba(0,0,0,1)";
            ctx.font = "bold "+titleH+"px Arial";
            y+=titleH;
            ctx.fillText(this.map_title.trim(),x,y); 
        }
        map_attribution = "Map data: © OpenStreetMap contributors. To learn more, visit https://www.openstreetmap.org/copyright.";
        if ( this.map_provider==='opentopomap' ) map_attribution = "Map data: © OpenStreetMap contributors, SRTM | Map display: © OpenTopoMap (CC-BY-SA). To learn more, visit https://opentopomap.org/";
        if ( this.map_provider==='cyclosm' ) map_attribution = "Map data: © OpenStreetMap contributors | Style: CyclOSM . To learn more, visit https://www.cyclosm.org/";
        if ( this.map_provider.startsWith('mapbox_') ) map_attribution = "Map data: © Mapbox, © OpenStreetMap and their data sources. To learn more, visit https://www.mapbox.com/about/maps/ and https://www.openstreetmap.org/copyright."
        var attribution=""+new Date().getFullYear()+" | Made with QRgeomap.com | "+map_attribution;
        y+=font_size*((titleH==0)?1.3:1.6);
        ctx.font = font_size+"px Arial";
        ctx.fillStyle="rgba(0,0,0,0.66)";
        ctx.fillText(attribution,x,y); 

        // The TRACK
        this.paintTrackOnCanvas();

        // The QR
        this.source_link_in_qr=this.source_link;
        QRgeomap.printQRgeomapOnImage ( this.canvas, this.mData.width, this.mData.height, this.mData.p1[1],this.mData.p1[0], this.mData.p2[1],this.mData.p2[0], this.source_link_in_qr )
            .then(()=>{
                this.imageSrc = this.canvas.toDataURL();    // show on screen
                this.mapReady=true;                         // Ready!
                if ( whenFinishedFunction!=null ) whenFinishedFunction();
            });      

  }

  mapIsPublishable() {
        return ( this.source_link_in_qr=="https://www.qrgeomap.com" || this.source_link_in_qr.startsWith("https://www.qrgeomap.com/") );
  }






  paintTrackOnCanvas() {
        // Paints the "track" on the canvas

        var waypointSize=2.5*this.baseFontSize();

        var ctx = this.canvas.getContext("2d");
        var x,y,p;
        var scale=1.0*this.canvas.width/this.mData.mapWidthPx;
        var n=this.track.points.length;
        // thick line (white stroke)
        var color="rgba(255,255,255,1)";
        var lineWidth=this.line_width*waypointSize/10;
        var xa,ya;
        for ( var i=0; i<n; i++ ) {
            p = this.track.points[i];
            x=scale*this.mData.mapWidthPx*(p.lon-this.mData.p1[0])/(this.mData.p2[0]-this.mData.p1[0]);
            y=scale*(this.mData.mapHeightPx-this.mData.mapHeightPx*(p.lat-this.mData.p2[1])/(this.mData.p1[1]-this.mData.p2[1]));
            if ( i>0 ) this.drawLine(ctx,xa,ya,x,y,color,lineWidth);
            xa=x;
            ya=y;
        }
        // "slim" line (selected color)
        color = this.color; 
        lineWidth = this.line_width*waypointSize/20;
        for ( var i=0; i<n; i++ ) {
            p = this.track.points[i];
            x=scale*this.mData.mapWidthPx*(p.lon-this.mData.p1[0])/(this.mData.p2[0]-this.mData.p1[0]);
            y=scale*(this.mData.mapHeightPx-this.mData.mapHeightPx*(p.lat-this.mData.p2[1])/(this.mData.p1[1]-this.mData.p2[1]));
            if ( i>0 ) this.drawLine(ctx,xa,ya,x,y,color,lineWidth);
            xa=x;
            ya=y;
        }

        // Waypoints, START, FINISH
        var wpts=this.points;
        if ( wpts.length>0 ) for ( var i=0; i<wpts.length; i++ ) {
            p = wpts[i];
            if ( p.visible ) {
                x=scale*this.mData.mapWidthPx*(p.lon-this.mData.p1[0])/(this.mData.p2[0]-this.mData.p1[0]);
                y=scale*(this.mData.mapHeightPx-this.mData.mapHeightPx*(p.lat-this.mData.p2[1])/(this.mData.p1[1]-this.mData.p2[1]));
                this.paintWptOnCanvas(ctx,x,y,waypointSize,p.name);
            }
        }

    }


    paintWptOnCanvas ( ctx,x,y,waypointSize,txt ) { 
        // Paints a waypoint
        ctx.beginPath();               
        var fillStyle = "rgba("+this.color+",0.75)";
        ctx.fillStyle = fillStyle;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(32,32,32,0.5)';
        ctx.moveTo(x-waypointSize*0.2,y+waypointSize*0.1);
        ctx.lineTo(x+waypointSize*0.2,y-waypointSize*0.1);
        ctx.moveTo(x-waypointSize*0.2,y-waypointSize*0.1);
        ctx.lineTo(x+waypointSize*0.2,y+waypointSize*0.1);
        ctx.moveTo(x,y);
        ctx.lineTo(x,y-waypointSize*0.5);
        ctx.lineTo(x+waypointSize*0.66,y-waypointSize*0.75);
        ctx.lineTo(x,y-waypointSize*1.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if ( txt!="" ) {
            var fontSize=Math.floor(waypointSize*0.4);
            ctx.font = fontSize+"px Arial";            
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = fontSize/3;
            var txtWidth = ctx.measureText(txt).width;
            ctx.strokeText(txt,x-txtWidth/2,y+fontSize*1.2);
            ctx.fillStyle=fillStyle;
            ctx.fillText(txt,x-txtWidth/2,y+fontSize*1.2);
        }
    }



    baseFontSize() {
        // base font size (for waypoints and scale...)
        return Math.floor(9*this.mapCanvas.width/960);
    }
  


    drawLine ( ctx,x1,y1,x2,y2,color,lineWidth ) { 
        // Draws a line
        ctx.strokeStyle=color; 
        ctx.lineWidth=lineWidth;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        ctx.fillStyle=color; 
        ctx.beginPath();
        ctx.arc(x2,y2,ctx.lineWidth/2,0,2*Math.PI,false);
        ctx.fill();
    }



    downloadMap () {
        // When the user taps the Download button --> downloads the map as PNG file
        var title=this.map_title;
        if ( title!="" ) title+=".";
        title+="QRgeomap.png";
        this.control.downloadCanvasAsPNGfile(this.canvas,title);
    }





    // ---------- Geo functions --------------


    distance ( lat1,lon1, lat2,lon2 ) {
        // Distance (Kms) between two points
        var p = 0.017453292519943295;    // Math.PI / 180
        var c = Math.cos;
        var a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
        var r = 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
        return r;
    }
    


    // Get the title of a point (and vice versa)
    // Source: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

    long2tile ( lon,zoom ) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
    lat2tile ( lat,zoom )  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }
    tile2long ( x,z ) {
        return (x/Math.pow(2,z)*360-180);
    }
    tile2lat ( y,z ) {
        var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
        return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
    }


    // After knowing the tile where a point is in, get the specific pixel coordinates that corresponds to it within the tile (0..255)

    long2pixelInTile ( lon,zoom ) {
        var tile=this.long2tile(lon,zoom);
        var L1=this.tile2long(tile,zoom);
        var L2=this.tile2long(tile+1,zoom);
        return Math.floor(256*(lon-L1)/(L2-L1));
    }

    lat2pixelInTile ( lat,zoom ) {
        var tile=this.lat2tile(lat,zoom);
        var L1=this.tile2lat(tile,zoom);
        var L2=this.tile2lat(tile+1,zoom);
        return Math.floor(256*(lat-L1)/(L2-L1));
    }










    // ---------- Publish Map --------------


    publishMap() { 
        // Publish the map image and get a link to use it

        // Prepare: get an "id" for the new map image
        this.control.httpJsonPost(this.QRGEOMAP_HOSTING_API_URL,{function:"prepare_new_file"},(data)=>{
            if ( data.status=="OK" ) {
                var id=data.id;
                var file_key=data.file_key;
                // Refresh the map with the link to the map "id" and upload it
                this.source_link = "https://www.qrgeomap.com/?p="+id;
                this.redrawMap(()=>{
                    const imageBase64 = this.canvas.toDataURL("image/png").split(';base64,')[1];
                    var params= {   function:"save_file", id:id, file_key:file_key, 
                                    title:this.map_title,
                                    topLeftLat:this.mData.p1[1],topLeftLon:this.mData.p1[0],bottomRightLat:this.mData.p2[1],bottomRightLon:this.mData.p2[0],
                                    imageBase64: imageBase64
                                };
                    this.control.httpJsonPost(this.QRGEOMAP_HOSTING_API_URL,params,(data)=>{
                        console.log(data);
                        if ( data.status=="OK" ) {

                            // Published! Show link and key
                            this.publishData = { url:""+this.source_link_in_qr, key:""+id+"-"+file_key };
                            this.source_link = "https://www.qrgeomap.com";
                            
                        } else { this.control.alert("ERROR",data.error); }
                    },(err)=>{ console.log(err); this.control.alert("ERROR","UNABLE_TO_PUBLISH_MAP"); });
                });
            } else { 
                this.control.alert("ERROR",data.error); 
            }
        },(err)=>{ console.log(err); this.control.alert("ERROR","UNABLE_TO_PUBLISH_MAP"); });
        
    }





}
