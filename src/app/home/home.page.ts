import { Component, ViewChild } from '@angular/core';
import { AlertController, IonModal } from '@ionic/angular';
import * as Leaflet from 'leaflet';
import { QRgeomap } from '../services/qrgeomap';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  @ViewChild(IonModal) modal: IonModal;

  lang:string="en";                           // user's language

  map: Leaflet.Map;                           // The map
  imageOverlay: Leaflet.ImageOverlay;         // overlay for the image map
  marker: Leaflet.marker;                     // current location marker  
  polyline=null;                              // array of points for the "track" (user locations...)


  loaded_map: boolean=false;                  // true when map finished loading
  loaded_map_url:string="";                   // the link (source) included in the QR geomap 
  source_bar_visible:boolean=false;           // set to false to hide the source bar

  watchPositionID=null;                       // ID of the location watcher


  constructor ( private alertController:AlertController ) {

      // set user's lang
      var lang:string = navigator.language.slice(0,2);
      if ( lang=="en"||lang=="es" ) this.setLang(lang)

  }


  setLang(lang) {
      this.lang=lang;
  }


  ngOnInit() { 

  }


  ionViewDidEnter() { 

      this.createLeafletMap(); 
      
      // Check if image map to be loaded is set in the url:
      // https://www.qrgeomap.com/?i=https:%2F%2Fwww.qrgeomap.com%2Fassets%2Fsample.png ("i" parameter will the the encoded url of the map image)

      var url:string=window.location.href;
      //console.log(url);
      if ( url.includes("?i=") ) {
            var img_url=decodeURIComponent(url.split("?i=")[1]);
            console.log(img_url);
            this.loadMapFromImageFile(img_url);
      }

      // Check if scanned the QR code with the camera...
      if ( url.includes("qrgeomap=") ) {
          var msg="It looks like you scanned the QR code of a map image to get here. <br><br>To use a QR geomap image you need to (first) download the map image that contains the QR code on its top-right corner and (second) press the 'Map' button in this app to select and load the map image.";
          if ( this.lang=="es" ) msg="Parece que escaneaste el código QR de una imagen de mapa para llegar aquí. <br><br>Para usar uno de estos mapas tienes que (primero) descargar la imagen de mapa que contiene el código QR en la esquina superior derecha y (segundo) presionar el botón 'Mapa' en esta aplicación para seleccionar y cargar la imagen del mapa.";
          this.showAlert("HEY!",msg);
      }

      
  }


  createLeafletMap() {

      // The map
      this.map = Leaflet.map('mapId').setView([28.644800, 77.216721], 2);
      
      // Background: openstreetmap online layer
      var options={ attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', opacity:0.33 };
      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',options).addTo(this.map);

      // Polyline layer: user's location track
      this.polyline = Leaflet.polyline([], {color:'red',weight:'4',dashArray:'1,10',dashOffset:'0'});
      this.polyline.addTo(this.map);

      Leaflet.control.scale({maxWidth:150,imperial:false}).addTo(this.map);

      // Initial location
      this.centerMapOnCurrentLocation();
     
      /*
      // Tests
      this.loadMapFromImageFile("assets/sample.png"); // test sample file
      // test points
      setTimeout(()=>{
          var pos;
          pos={lat:36.764118,lng:-4.710391}; this.polyline.addLatLng(pos); this.updateMarker(pos);
          pos={lat:36.765277,lng:-4.704527}; this.polyline.addLatLng(pos); this.updateMarker(pos);
          pos={lat:36.762940,lng:-4.703527}; this.polyline.addLatLng(pos); this.updateMarker(pos);
      },1000);
      */
      

  }


  onInputFileSelected (evt) {
      // user selected a file --> Load the map

      var tgt = evt.target || window.event.srcElement,
      files = tgt.files;
      // FileReader support
      if ( FileReader && files && files.length ) {
          var fr = new FileReader();
          fr.onload = ()=>{
              this.loadMapFromImageFile(fr.result);
              var inputFile:any=document.getElementById('input'); inputFile.value = "";
          }
          fr.readAsDataURL(files[0]);
      }
      else { // Not supported
      }

  }



  loadMapFromImageFile ( file ) {
      // Loads the (image) file, extracts geolocation from QR and shows on the map as Image Overlay layer

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
              url=url.split("qrgeomap=")[0];
              url=url.replace("?","");
              this.loaded_map_url=url;
              if ( this.loaded_map_url=="https://www.qrgeomap.com/" ) this.loaded_map_url="";

              this.loaded_map=true;
              this.source_bar_visible=true;
              this.polyline.setLatLngs([]); // Restart track
          
          }).catch((err)=>{ this.showAlert("ERROR",err) });

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
                  this.updateMarker({lat:lat,lng:lng});

              }, (err)=>{}, options );
      }//else

  }


  updateMarker ( latlng ) {
      // create/update marker in the current location (latlng)

      if ( this.marker==null ) {
            var myIcon = Leaflet.icon({iconUrl:'assets/red-marker.png',iconSize:[28,42],iconAnchor:[14,42]});
            this.marker = Leaflet.marker(latlng,{icon:myIcon}).addTo(this.map).on('click',()=>{this.onClickMarker();});
            this.marker.setOpacity(0.85);
      } 
      this.marker.setLatLng(latlng);

  }


  onClickMarker() {
      // when marker is clicked --> show alert with its coordinates
      var pos=this.marker.getLatLng();
      this.showAlert("Lat,Lon",""+pos.lat+","+pos.lng);
  }





  // ------------------- some helpers... -----------------------


  closeModal() {
      // Closes the modal dialog 
      this.modal.dismiss(null, 'cancel');
  }


  async showAlert ( title, content ) {
      // Shows an Alert dialog with title and content
      const alert = await this.alertController.create({
          header: title,
          message: content,
          buttons: ['OK'],
          cssClass:'TextSelectable'
      });
      await alert.present();
  }






}
