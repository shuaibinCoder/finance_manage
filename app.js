const env = require('./config/env')

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发')
      return
    }
    wx.cloud.init({
      env: env.cloudEnvId,
      traceUser: true
    })
  },

  globalData: {
    appName: '小微财报',
    cloudEnvId: env.cloudEnvId
  }
})
