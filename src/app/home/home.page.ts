import { Component, ViewChild } from '@angular/core';
import { AlertController, IonModal } from '@ionic/angular';
import * as Leaflet from 'leaflet';
import { Control } from '../services/control';
import { QRgeomap } from '../services/qrgeomap';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  @ViewChild(IonModal) modal: IonModal;


  map: Leaflet.Map;                           // The map
  imageOverlay: Leaflet.ImageOverlay;         // overlay for the image map
  redMarker: Leaflet.marker;                  // red marker: current user location  
  greyMarker: Leaflet.marker;                 // grey marker: where the user taps  
  polyline=null;                              // array of points for the "track" (user locations...)


  loaded_map: boolean=false;                  // true when map finished loading
  loaded_map_thumbnail: string="";            // A thumbnail of the loaded map (dataURL)  
  loaded_map_url:string="";                   // the link (source) included in the QR geomap 
  current_map_link:string="";                 // the full link of the current loaded map ("https://www.qrgeomap.com...")  
  source_bar_visible:boolean=false;           // set to false to hide the source bar

  watchPositionID=null;                       // ID of the location watcher

  initialized=false;


  constructor ( public control:Control, private alertController:AlertController ) {

    this.control.homePage=this;

  }


  ngOnInit() { 

  }


  async ionViewDidEnter() { 

      if ( this.initialized ) { 
          setTimeout(()=>{ 
              this.map.invalidateSize(); 
              console.log("redraw map!");
          },500); // force redraw!
          return; 
      }

      // initialize !

      this.createLeafletMap(); 
      
      // Check if image map to be loaded is set in the url:

      var url:string=window.location.href;
      //console.log(url);


      if ( url.includes("?i=") ) {  
            // URL includes link to image map --> Load it!
            // https://www.qrgeomap.com/?i=https:%2F%2Fwww.qrgeomap.com%2Fassets%2Fsample.png ("i" parameter will the the encoded url of the map image)

            var img_url=decodeURIComponent(url.split("?i=")[1]);
            this.loadMapFromImageSrc(img_url,url);

      } else if ( url.includes("?p=") ) { 
            // URL includes the "id" of a published map --> Load it!

            var id=decodeURIComponent(url.split("?p=")[1]);
            var img_url="https://www.wandapps.com/_qrgeomap_hosting/index.php?a=get_image&id="+id;
            this.loadMapFromImageSrc(img_url,url);

      } else if ( url.includes("qrgeomap=") ) { 
            // Scanned the QR code (of a not published file) with the camera ...

            var msg="You have scanned the QR code of a map that does not include a download link, only its geolocation. In order to use this map here you would need to have it saved on this device and then load it from the 'Open Map' button in this application.";
            if ( this.control.lang=="es" ) msg="Has escaneado el código QR de un mapa que no incluye enlace para descarga, solo su geolocalización. Para usar ese mapa aquí tendrías que tenerlo guardado en este dispositivo y luego cargarlo desde el botón 'Abrir Mapa' de esta aplicación.";
            this.control.alert("HEY!",msg);

      } else {
            // (Try to) load the last map

            this.loadLastMap();
      }

      this.initialized=true;
      
  }


  createLeafletMap() {

      // The map
      this.map = Leaflet.map('mapId').setView([28.644800, 77.216721], 2);
      
      // Background: openstreetmap online layer
      var options={ attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', opacity:0.5 };
      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',options).addTo(this.map);

      // Polyline layer: user's location track
      this.polyline = Leaflet.polyline([], {color:'red',weight:'4',dashArray:'1,10',dashOffset:'0'});
      this.polyline.addTo(this.map);

      Leaflet.control.scale({maxWidth:150,imperial:false}).addTo(this.map);

      this.map.on('click',(e)=>this.updateGreyMarker(e.latlng));

      // Initial location
      this.centerMapOnCurrentLocation();

  }


  async onMapFileSelected (evt) {
      // user selected a file --> read the file and show the map

      await this.control.showLoading(this.control.getString("LOADING_MAP")+"...");

      var tgt = evt.target || window.event.srcElement,
      files = tgt.files;
      if ( FileReader && files && files.length ) {
          var fr = new FileReader();
          fr.onload = ()=>{
              this.loadMapFromImageSrc(fr.result,"");
              var inputFile:any=document.getElementById('input_map_fab'); inputFile.value = "";
          };
          fr.onerror = () => {
            this.control.hideLoading();
            this.control.alert("ERROR","COULD_NOT_LOAD_MAP"); 
          };
          fr.readAsDataURL(files[0]);
      }

  }


  img:HTMLImageElement;     // aux img to load the map

  async loadMapFromImageSrc ( url_or_dataurl:any, link:string="", isLastMap:boolean=false ) {
      // Loads the image, extracts geolocation from QR and shows it on the leaflet map as Image Overlay layer
      // (step 1)
      // "url_or_dataurl" must be the image file (already read as dataUrl) or the url of an image map
      // "link" must be the original url of this map (https://www.qrgeomap.com...) / "" if comes from a local file selected
      // "isLastMap" must be true if we are reloading the last map saved

      await this.control.showLoading(this.control.getString("LOADING_MAP")+"...");

      //console.log(file_or_url);
      this.img = new Image();
      this.img.crossOrigin = "Anonymous";
      this.img.onload = () => { 
          this.loadMapFromImageSrc2(link,isLastMap);
      }; // img.onload
      this.img.onerror = () => {
          this.control.hideLoading();
          this.control.alert("ERROR","COULD_NOT_LOAD_MAP"); 
      };
      this.img.onprogress = (e:any) => {
          var completedPercentage = Math.round(100 * parseInt(e.loaded)/parseInt(e.total));
          this.control.updateLoadingMessage(this.control.getString("LOADING_MAP")+"... ("+completedPercentage+"%)");
      };
      this.img.src = url_or_dataurl;

  }


  async loadMapFromImageSrc2 ( link:string, isLastMap:boolean ) {
        // (step 2) image is loaded --> extracts geolocation... 

        var canvas = document.createElement("canvas"); 
        canvas.width = this.img.naturalWidth;
        canvas.height = this.img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this.img,0,0);            
        QRgeomap.extractQRgeomapFromImage(canvas).then((geodata:any)=>{
            // geodata = { url, originalMapWidth, originalMapHeight, topLeftLat,topLeftLon, bottomRightLat,bottomRightLon, currentMapBottomLat }

            var imageDataUrl = canvas.toDataURL(); // the canvas, now with the QR code removed!

            // image bounds
            var p1=[geodata.topLeftLat,geodata.topLeftLon];
            var p2=[geodata.currentMapBottomLat,geodata.bottomRightLon];
            var imageBounds = [ p1,p2 ]; 

            // Add imageOverlay to the map (possibly removing the last one)
            if ( this.imageOverlay ) this.map.removeLayer(this.imageOverlay);
            this.imageOverlay=Leaflet.imageOverlay(imageDataUrl, imageBounds, { opacity:1.0 } );
            this.imageOverlay.addTo(this.map);
            this.map.fitBounds(imageBounds);    

            // Show toolbar with "Source" info (link), if present in the QR
            var url=geodata.url;
            if ( url.includes("?qrgeomap=") ) url=url.split("?qrgeomap=")[0];
            else if ( url.includes("&qrgeomap=") ) url=url.split("&qrgeomap=")[0];
            this.loaded_map_url=url;
            if ( this.loaded_map_url.startsWith("https://www.qrgeomap.com") ) this.loaded_map_url="";

            this.loaded_map=true;
            this.source_bar_visible=true;
            if ( this.isWatchingPosition() ) this.watchPosition();              // Stop if was watching position 
            this.polyline.setLatLngs([]);                                       // Restart track line
            
            this.makeThumbnail();                                               // Make thumb of the current map

            this.control.hideLoading();                                         // Map loading finished!

            if ( isLastMap ) {
                this.control.toast("LAST_MAP_RELOADED"); 
            } else {
                this.saveCurrentMap(link);                                      // Save the new map loaded (to be able to restore later)
                this.control.alert("MAP_LOADED_TITLE","MAP_LOADED_TEXT");
            }

        }).catch((err)=>{ 
            this.control.hideLoading();
            this.control.alert("ERROR",err) 
        });

  }


  makeThumbnail () {
        // creates the thumnail of the loaded map (img)
        var sw=this.img.naturalWidth;
        var sh=this.img.naturalHeight;
        var canvas = document.createElement("canvas"); 
        var dw=180;
        var dh=dw*sh/sw;
        canvas.width = dw;
        canvas.height = dh;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this.img,0,0,sw,sh,0,0,dw,dh); 
        this.loaded_map_thumbnail = canvas.toDataURL();
        //console.log("loaded_map_thumbnail",this.loaded_map_thumbnail);
  }


  async saveCurrentMap ( link:string ) {
        // Saves the current map and its link

        var canvas = document.createElement("canvas"); 
        canvas.width = this.img.naturalWidth;
        canvas.height = this.img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this.img,0,0); 
        var current_map_dataUrl = canvas.toDataURL();
        await this.control.setStorageItem("current_map_link",link);
        await this.control.setStorageItem("current_map_dataUrl",current_map_dataUrl);
        setTimeout(()=>{this.current_map_link=link;},1);
        console.log("current map saved!"); 

  }


  async loadLastMap () {
        // (Tries to) load the last saved map in local storage

        this.current_map_link=await this.control.getStorageItem("current_map_link"); 
        if ( this.current_map_link==null ) this.current_map_link="";
        //this.current_map_link="https://www.qrgeomap.com/?p=11"; // test

        var current_map_dataUrl=await this.control.getStorageItem("current_map_dataUrl"); 
        if ( current_map_dataUrl ) {
            this.loadMapFromImageSrc(current_map_dataUrl,this.current_map_link,true);
            console.log("current map loaded!"); 
        }

  }


  downloadCurrentMap() {
        // Downloads the current map
        var canvas = document.createElement("canvas"); 
        canvas.width = this.img.naturalWidth;
        canvas.height = this.img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(this.img,0,0); 
        this.control.downloadCanvasAsPNGfile(canvas,"QRgeomap.png");
  }



  hideSourceBar() {
      // Hides the "Source bar"
      this.source_bar_visible=false;
  }



  centerMapOnCurrentLocation () {
        // gets current location and centers the map on it
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            if (result.state === "granted") {
                navigator.geolocation.getCurrentPosition(pos => {
                    this.map.setView([pos.coords.latitude,pos.coords.longitude],12);
                });
            }
        });
  }

  

  permissionAlertShown = false;


  watchPosition () {
      // Starts/stops the location watcher.
      // When it's active it adds every coordinates received to the poliline ("track") that is shown on top of the image overlay

      if ( this.isWatchingPosition() ) { // stop watching
          
          navigator.geolocation.clearWatch(this.watchPositionID);
          this.watchPositionID=null;
          this.permissionAlertShown = false;

      } else { // start watching
          
          var options={ enableHighAccuracy:true, timeout:10000, maximumAge:0 };
          this.watchPositionID = navigator.geolocation.watchPosition(
              (position) => {

                  //console.log(position);
                  var lat=position.coords.latitude;
                  var lng=position.coords.longitude;

                  // add current location to "red track"
                  var point = {lat: lat, lng: lng};
                  this.polyline.addLatLng(point);

                  // center map in current point
                  this.map.setView([lat,lng]);
                  // draw marker
                  this.updateRedMarker({lat:lat,lng:lng});

              }, (err)=>{

                    if ( err.code === err.PERMISSION_DENIED ) {

                        // IMPORTANT!! iOS Safari can repeat the error callback multiple times unless we stop the watcher!
                        navigator.geolocation.clearWatch(this.watchPositionID);
                        this.watchPositionID = null;

                        if ( !this.permissionAlertShown ) {
                            this.permissionAlertShown = true;
                            this.control.alert("ERROR","LOCATION_PERMISSION_DENIED");
                        }
                    }

              }, options );
      }//else

  }



  

  isWatchingPosition () {
        return this.watchPositionID!=null;
  }


  updateRedMarker ( latlng ) {
      // create/update red marker in the current location (latlng)

      if ( this.redMarker==null ) {
            var myIcon = Leaflet.icon({iconUrl:'assets/red-marker.png',iconSize:[28,42],iconAnchor:[14,42]});
            this.redMarker = Leaflet.marker(latlng,{icon:myIcon}).addTo(this.map).on('click',()=>{this.onClickMarker(this.redMarker);});
            this.redMarker.setOpacity(0.9);
      } 
      this.redMarker.setLatLng(latlng);
  }


  updateGreyMarker ( latlng ) {
      // Fires when the user taps on the map --> place the grey marker
      if ( this.greyMarker==null ) {
            var myIcon = Leaflet.icon({iconUrl:'assets/grey-marker.png',iconSize:[28,42],iconAnchor:[14,42]});
            this.greyMarker = Leaflet.marker(latlng,{icon:myIcon}).addTo(this.map).on('click',()=>{this.onClickMarker(this.greyMarker);});
            this.greyMarker.setOpacity(0.75);
      } 
      this.greyMarker.setLatLng(latlng);
  }


  onClickMarker(marker) {
      // when marker is clicked --> show alert with its coordinates
      var pos=marker.getLatLng();
      var lat=Math.round(pos.lat*10000000)/10000000;
      var lng=Math.round(pos.lng*10000000)/10000000;
      var latlng=""+lat+","+lng;
      this.control.copyToClipboard(latlng);
      this.control.alert("Lat,Lon",latlng);
  }







}
