import { Component, OnInit } from '@angular/core';
import { Control } from '../services/control';

@Component({
  selector: 'app-legal',
  templateUrl: './legal.component.html',
  styleUrls: ['./legal.component.scss'],
})
export class LegalComponent implements OnInit {

  constructor ( public control:Control ) { }

  ngOnInit() {}

}
