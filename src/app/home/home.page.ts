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
  loaded_map_url:string="";                   // the link (source) included in the QR geomap 
  source_bar_visible:boolean=false;           // set to false to hide the source bar

  watchPositionID=null;                       // ID of the location watcher

  initialized=false;

  constructor ( public control:Control, private alertController:AlertController ) {

    this.control.homePage=this;

  }




  ngOnInit() { 

  }


  ionViewDidEnter() { 

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
      // https://www.qrgeomap.com/?i=https:%2F%2Fwww.qrgeomap.com%2Fassets%2Fsample.png ("i" parameter will the the encoded url of the map image)

      var url:string=window.location.href;
      //console.log(url);

      if ( url.includes("?i=") ) {  // URL includes link to image map --> Load it

            var img_url=decodeURIComponent(url.split("?i=")[1]);
            this.loadMapFromImageFile(img_url);

      } else if ( url.includes("?p=") ) { // URL includes the "id" of a published map --> Load it

            var id=decodeURIComponent(url.split("?p=")[1]);
            var img_url="https://www.wandapps.com/_qrgeomap_hosting/index.php?a=get_image&id="+id;
            this.loadMapFromImageFile(img_url);

      } else if ( url.includes("qrgeomap=") ) { // Scanned the QR code (of a not published file) with the camera ...

            var msg="It looks like you scanned the QR code of a map image to get here. <br><br>To use a QR geomap image you need to (first) download the map image and (second) press the 'Map' button in this app to load the map image.";
            if ( this.control.lang=="es" ) msg="Parece que escaneaste el código QR de una imagen de mapa para llegar aquí. <br><br>Para usar uno de estos mapas tienes que (primero) descargar la imagen del mapa y (segundo) presionar el botón 'Mapa' en esta aplicación para cargar la imagen del mapa.";
            this.control.alert("HEY!",msg);

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


  onMapFileSelected (evt) {
      // user selected a file --> Load the map

      var tgt = evt.target || window.event.srcElement,
      files = tgt.files;
      if ( FileReader && files && files.length ) {
          var fr = new FileReader();
          fr.onload = ()=>{
              this.loadMapFromImageFile(fr.result);
              var inputFile:any=document.getElementById('input_map_fab'); inputFile.value = "";
          }
          fr.readAsDataURL(files[0]);
      }

  }



  loadMapFromImageFile ( file ) {
      // Loads the (image) file, extracts geolocation from QR and shows on the map as Image Overlay layer

      console.log(file);

      var img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => { 

          var canvas = document.createElement("canvas"); 
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img,0,0);            
          QRgeomap.extractQRgeomapFromImage(canvas).then((geodata:any)=>{
              // geodata = { url, originalMapWidth, originalMapHeight, topLeftLat,topLeftLon, bottomRightLat,bottomRightLon, currentMapBottomLat }

              var imageDataUrl = canvas.toDataURL(); // the canvas, now with the QR code removed!

              var p1=[geodata.topLeftLat,geodata.topLeftLon];
              var p2=[geodata.currentMapBottomLat,geodata.bottomRightLon];
              var imageBounds = [ p1,p2 ]; // image bounds

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
              this.polyline.setLatLngs([]); // Restart track
          
          }).catch((err)=>{ this.control.alert("ERROR",err) });

      }; //imageQRgeomap.onload 
      img.src = file;

  }



  hideSourceBar() {
      // Hides the "Source bar"
      this.source_bar_visible=false;
  }



  centerMapOnCurrentLocation () {
      // gets current location and centers the map on it
      navigator.geolocation.getCurrentPosition((position) => {
          this.map.setView([position.coords.latitude,position.coords.longitude],12);
      });
  }

  

  watchPosition ( ) {
      // Starts/stops the location watcher.
      // When it's active it adds every coordinates received to the poliline ("track") that is shown on top of the image overlay

      if ( this.watchPositionID!=null ) { // stop watching
          
          navigator.geolocation.clearWatch(this.watchPositionID);
          this.watchPositionID=null;

      } else { // start watching
          
          var options={ enableHighAccuracy:true, timeout:3000 };
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

              }, (err)=>{}, options );
      }//else

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
      this.control.alert("Lat,Lon",""+lat+","+lng);
  }







}
