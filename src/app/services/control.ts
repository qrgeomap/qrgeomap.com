import { Injectable  } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { saveAs } from 'file-saver';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AlertController, MenuController, NavController  } from '@ionic/angular';



//  ***  Global app control class  ***



//declare var window:any;

@Injectable()
export class Control {


  homePage:any=null;    // Pointer to the homePage


  constructor ( public translate: TranslateService, 
                public http:HttpClient,
                public alertCtrl:AlertController,
                public menuController:MenuController,
                private router: Router,
                private navController:NavController
                ) {

        // set user's lang
        var lang=this.getNavigatorLang();
        if ( lang=="en"||lang=="es" ) this.setLang(lang);
        //this.setLang("en"); // forced (developing...)

  }



    // ----------------- LANG ---------------------------------------------------------------------

  
    lang:string="en";


    getNavigatorLang() {
        return navigator.language.slice(0,2)
    }

    setLang(lang) {
        this.lang=lang;
        this.translate.setDefaultLang(lang);
    }

    getString(str) {
        return this.translate.instant(str);
    }


    // ----------------- NAVIGATOR / BROWSER / URL  -----------------------------------------------


    public navigate( route, params ) {
        // Navigate to internal route (page)
        this.router.navigate([route, params],{ skipLocationChange:true }); 
        this.closeMenu();
    }
  
    public back() {
        // go to prevous page
        this.navController.pop();
    }

    public backToHome() {
        // back to homepage
        this.navigate("home",{});
    }


    getUrlParameterByName ( name ) {
        // finds and returns the value of 'name' parameter (of the current url)
        var url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }




    // Dialogs...
  
    alert ( title,txt ) {
        // shows a alert dialog with a title, text and OK button

        this.translate.get(["OK",title,txt]).subscribe((s)=>{
            this.alertCtrl.create({
                cssClass: 'my-custom-alert-class',
                header: s[title],
                subHeader: "",
                message: s[txt],
                buttons: [ s["OK"] ]
            }).then((alertEl) => {
                alertEl.present();
            });
        });

    }


    closeMenu() {
        // Closes the app menu
        this.menuController.close();
   }



  // -------------------------- FILES ----------------------------------


  removeExtension ( filename ) {
      // returns the 'filename' removing the extension. E.g: "sample.gpx" --> "sample" 
      var lastDotPosition = filename.lastIndexOf(".");
      if (lastDotPosition === -1) return filename;
      else return filename.substr(0, lastDotPosition);
  }


  checkFileExtensionGPX ( filename ) {
      // true if 'filename' is a GPX file
      var str = ""+filename;
      return str.toUpperCase().endsWith(".GPX");
  }



  downloadCanvasAsPNGfile ( canvas, filename ) {
      // Downloads a picture ("canvas") as a PNG file (named "filename")
      canvas.toBlob(function(blob) {
          saveAs(blob, filename);
      });
  }


  // -------------------------- HTTP ----------------------------------

  httpJsonPost ( url, postParams, onDataReceivedFunction, onErrorFunction ) {
        // http post with JSON data
        console.log(postParams);
        let jsonHeaders: { [key: string]: string } = { 'Content-Type':'application/json' };
        let httpOptions = { headers: new HttpHeaders(jsonHeaders) } 
        this.http.post(url, postParams, httpOptions).subscribe({
        next: (data) => {
            onDataReceivedFunction(data);
        },
        error: (error) => {
            onErrorFunction(error);
        },
        });      
  }

  


}
