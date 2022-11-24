import { Component, OnInit } from '@angular/core';
import { Control } from '../services/control';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
})
export class AboutPage implements OnInit {


  constructor(public control:Control) {
  }

  ngOnInit() {
  }


}
