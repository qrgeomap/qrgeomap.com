import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';


@NgModule({
	imports: [
		CommonModule,FormsModule,IonicModule,
		TranslateModule.forChild({
			loader: { 
			  provide: TranslateLoader, 
			  useFactory: (createTranslateLoader), 
			  deps: [HttpClient] 
			} 
		  })
	],
	declarations: [
	],
	exports: [
		TranslateModule,
	]
})
export class ComponentsModule {}

export function createTranslateLoader(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
  }
  