import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "app-redirect",
  standalone: true,
  template: '',
  styles: []
})
export class RedirectComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    // Instead of window.location.href, use Angular router
    this.router.navigateByUrl('/testing');
  }
}
