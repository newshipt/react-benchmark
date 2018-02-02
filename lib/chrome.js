'use strict'
const EventEmitter = require('events')
const puppeteer = require('puppeteer')

let chrome

class Chrome extends EventEmitter {
  async start(port, devtools) {
    let completed = false

    chrome = await puppeteer.launch({ devtools })
    const page = await chrome.newPage()

    chrome.on('disconnected', () => {
      chrome = null

      if (completed) {
        this.emit('close')
      } else {
        this.emit('error', new Error('Chrome disconnected unexpectedly'))
      }
    })
    chrome.on('targetdestroyed', async target => {
      try {
        if ((await target.page()) === page) {
          if (completed) {
            this.emit('close')
          } else {
            this.emit('error', new Error('Chrome tab closed unexpectedly'))
          }
        }
      } catch (err) {
        // Workaround target.page() throwing an error when Chrome is closing
        if (!err.message.includes('No target with given id found undefined')) {
          this.emit('error', err)
        }
      }
    })

    page.on('console', msg => console.log(`console.${msg.type()}:`, msg.text()))
    page.on('pageerror', err => {
      this.emit('error', err)
    })
    page.on('requestfailed', request => {
      const error = new Error(`${request.failure().errorText} ${request.url()}`)
      this.emit('error', error)
    })

    page.exposeFunction('benchmarkProgress', data => {
      const benchmark = JSON.parse(data)
      this.emit('progress', benchmark)
    })

    page.exposeFunction('benchmarkComplete', data => {
      const benchmark = JSON.parse(data)
      completed = true
      this.emit('complete', benchmark)
    })

    this.emit('start')

    await page.goto(`http://localhost:${port}`)
  }

  async stop() {
    if (chrome) {
      await chrome.close()
      chrome = null
    }
  }
}

module.exports = new Chrome()