import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Control } from './services/control';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  
  constructor(public control:Control) {
  }


  onMapFileSelected (evt) {
      // user selected a file --> Load the map

      var tgt = evt.target || window.event.srcElement, 
      files = tgt.files;
      if ( FileReader && files && files.length ) {
          var fr = new FileReader();
          fr.onload = ()=>{
              this.control.homePage.loadMapFromImageSrc(fr.result);
              var inputFile:any=document.getElementById('input_map_menu'); inputFile.value = "";
          }
          fr.readAsDataURL(files[0]);
      }
      this.control.closeMenu();

  }


}
