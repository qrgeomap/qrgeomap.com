import { Injectable  } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { saveAs } from 'file-saver';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AlertController, LoadingController, MenuController, NavController, ToastController  } from '@ionic/angular';
import { NgForage, Driver, NgForageCache, CachedItem } from 'ngforage';



//  ***  Global app control class  ***



//declare var window:any;

@Injectable()
export class Control {


  homePage:any=null;    // Pointer to the homePage


  constructor ( public translate: TranslateService, 
                public http:HttpClient,
                public alertCtrl:AlertController,
                public toastCtrl:ToastController,
                public menuController:MenuController,
                public loadingController: LoadingController,
                private router: Router,
                private navController:NavController,
                private readonly ngf: NgForage, 
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


    closeMenu() {
        // Closes the app menu
        this.menuController.close();
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

    async toast ( txt, duration=3000 ) {
        // shows a toast message

        this.translate.get(txt).subscribe(async (text)=>{
            console.log(text);
            let toast = await this.toastCtrl.create({
                message: text,
                duration: duration,
                position: 'bottom'
            });
            if (text&&text.length>0) toast.present();
            //console.log("toast: "+text);
        });
    }
    

    // Legal modal

    isLegalModalOpen = false;
    canDismissLegalModal = false;

    showLegal(v) {
        this.canDismissLegalModal=true;
        this.closeMenu();
        setTimeout(()=>{
            console.log(v);
            this.isLegalModalOpen=v;
            if ( v==true ) this.canDismissLegalModal=false;
        },1);
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

  
  // -------------------------- LOADING SPINNER -----------------------

  isLoading = false;
  loadingDialog: any = null;

  async showLoading ( text="" ) {

    if ( this.isLoading ) {
        this.updateLoadingMessage(text);
        return; 
    } 

    var message = ( text=="") ? this.getString("PLEASE_WAIT") : text;
    this.isLoading = true;
    return await this.loadingController.create({
      // duration: 5000,
      message: message
    }).then( dialog => {
        this.loadingDialog = dialog;
        this.loadingDialog.present().then(() => {
          /*console.log('presented');*/
          if ( !this.isLoading ) {
            this.loadingDialog.dismiss().then(() => { /*console.log('abort presenting');*/ } );
          }
        });
    });

  }

  updateLoadingMessage ( message ) {
    this.loadingDialog.message=message;
  }

  async hideLoading () {

    this.isLoading = false;
    return await this.loadingController.dismiss().then(() => { /*console.log('dismissed');*/ } );

  }




  // -------------------------- STORAGE ----------------------------------

    public setStorageItem ( key:string, data:any ) : Promise<any> {
        // Saves "data" to persistent storage with "key". 
        // Returns promise! --> use: await this.control.setStorageItem("my_key",123);
        return this.ngf.setItem ( key, data );
    }

    public getStorageItem<T = any> ( key:string ) : Promise<T> {
        // Gets the "data" stored on "key". 
        // Returns promise! --> use: var data = await this.control.getStorageItem("my_key");
        return this.ngf.getItem<T>(key);
    }






  // -------------------------- MISC ----------------------------------

  async getImgAsync ( imgSrc ) {
        // Loads an image (async!) and returns it.
        return new Promise( (resolve, reject) => { 
            var img = new Image();
            img.onload = () => { 
                resolve(img);
            }; 
            img.src = imgSrc;         
        }); 
  } 

    
  async copyToClipboard ( text, auxTextarea=null ) {
        // Copy "text" to clipboard
        var input:any = null;
        if ( auxTextarea ) {
            input=document.getElementById(auxTextarea);
            input.innerHTML = text;
            input.select();
            document.execCommand('copy');
        } else {
            input=document.createElement('textarea');
            input.innerHTML = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        this.toast("COPIED");
  }



}
