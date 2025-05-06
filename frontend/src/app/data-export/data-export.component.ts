/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Component, type OnInit } from '@angular/core'
import { UntypedFormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ImageCaptchaService } from '../Services/image-captcha.service'
import { DataSubjectService } from '../Services/data-subject.service'
import { DomSanitizer } from '@angular/platform-browser'
import { MatButtonModule } from '@angular/material/button'
import { MatInputModule } from '@angular/material/input'
import { MatLabel, MatFormFieldModule, MatHint, MatError } from '@angular/material/form-field'
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio'
import { NgIf } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { MatCardModule } from '@angular/material/card'
import { FlexModule } from '@angular/flex-layout/flex'
import { MatIconModule } from '@angular/material/icon'

@Component({
  selector: 'app-data-export',
  templateUrl: './data-export.component.html',
  styleUrls: ['./data-export.component.scss'],
  imports: [FlexModule, MatCardModule, TranslateModule, NgIf, MatRadioGroup, FormsModule, ReactiveFormsModule, MatLabel, MatRadioButton, MatFormFieldModule, MatInputModule, MatHint, MatError, MatButtonModule, MatIconModule]
})
export class DataExportComponent implements OnInit {
  public captchaControl: UntypedFormControl = new UntypedFormControl('', [Validators.required, Validators.minLength(5)])
  public formatControl: UntypedFormControl = new UntypedFormControl('', [Validators.required])
  public captcha: any
  private dataRequest: any = undefined
  public confirmation: any
  public error: any
  public lastSuccessfulTry: any
  public presenceOfCaptcha: boolean = false
  public userData: any

  constructor (public sanitizer: DomSanitizer, private readonly imageCaptchaService: ImageCaptchaService, private readonly dataSubjectService: DataSubjectService) { }
  ngOnInit (): void {
    this.needCaptcha()
    this.dataRequest = {}
  }

  needCaptcha () {
    const nowTime = new Date()
    let timeOfCaptcha = new Date(0)
    
    try {
      const storedTime = localStorage.getItem('lstdtxprt')
      if (storedTime) {
        const parsedTime = JSON.parse(String(storedTime))
        if (parsedTime && !isNaN(new Date(parsedTime).getTime())) {
          timeOfCaptcha = new Date(parsedTime)
        }
      }
    } catch (err) {
      console.log('Error parsing timestamp from localStorage:', err)
    }
    
    if (nowTime.getTime() - timeOfCaptcha.getTime() < 300000) {
      this.getNewCaptcha()
      this.presenceOfCaptcha = true
    }
  }

  getNewCaptcha () {
    this.imageCaptchaService.getCaptcha().subscribe((data: any) => {
      this.captcha = this.sanitizer.bypassSecurityTrustHtml(data.image)
    })
  }

  save () {
    if (this.presenceOfCaptcha) {
      this.dataRequest.answer = this.captchaControl.value
    }
    this.dataRequest.format = this.formatControl.value
    this.dataSubjectService.dataExport(this.dataRequest).subscribe((data: any) => {
      this.error = null
      this.confirmation = data.confirmation
      this.userData = data.userData
      const newWindow = window.open('', '_blank', 'width=500')
      if (newWindow) {
        newWindow.document.write('<!DOCTYPE html><html><head><title>Data Export</title></head><body></body></html>')
        const preElement = newWindow.document.createElement('pre')
        preElement.textContent = this.userData // Use textContent to prevent XSS
        newWindow.document.body.appendChild(preElement)
      }
      this.lastSuccessfulTry = new Date()
      localStorage.setItem('lstdtxprt', JSON.stringify(this.lastSuccessfulTry))
      this.ngOnInit()
      this.resetForm()
    }, (error) => {
      this.error = error.error
      this.confirmation = null
      this.resetFormError()
    })
  }

  resetForm () {
    this.captchaControl.markAsUntouched()
    this.captchaControl.markAsPristine()
    this.captchaControl.setValue('')
    this.formatControl.markAsUntouched()
    this.formatControl.markAsPristine()
    this.formatControl.setValue('')
  }

  resetFormError () {
    this.captchaControl.markAsUntouched()
    this.captchaControl.markAsPristine()
    this.captchaControl.setValue('')
  }
}
