const repository = require('../../repositories/report-repository')
const env = require('../../config/env')

Page({
  data: {
    items: [
      { key: 'reportPending', label: '月报待确认', desc: '财务提交月报后提醒老板处理', configured: false, status: '', platformBlocked: false },
      { key: 'reportReturned', label: '月报被退回', desc: '老板退回月报后提醒财务修改', configured: false, status: '', platformBlocked: false },
      { key: 'reportConfirmed', label: '月报已确认', desc: '月报确认完成后通知相关成员', configured: false, status: '', platformBlocked: false }
    ],
    loading: true,
    requestingKey: '',
    mainSwitchOff: false
  },

  onLoad: async function () {
    await this.loadPreferences()
  },

  onShow: async function () {
    if (this.data.loading) return
    await this.refreshPlatformSetting()
  },

  loadPreferences: async function () {
    let preferences = {}
    try {
      const saved = await repository.getNotificationPreferences()
      preferences = saved.preferences || {}
    } catch (error) {}

    const items = this.data.items.map(function (item) {
      return Object.assign({}, item, {
        configured: Boolean(env.subscriptionTemplates[item.key]),
        status: preferences[item.key] || ''
      })
    })
    this.setData({ items: items, loading: false })
    await this.refreshPlatformSetting()
  },

  getWechatSetting: function () {
    return new Promise(function (resolve, reject) {
      wx.getSetting({
        withSubscriptions: true,
        success: resolve,
        fail: reject
      })
    })
  },

  refreshPlatformSetting: async function () {
    try {
      const setting = await this.getWechatSetting()
      const subscriptions = setting.subscriptionsSetting || {}
      const itemSettings = subscriptions.itemSettings || {}
      const mainSwitchOff = subscriptions.mainSwitch === false
      const items = this.data.items.map(function (item) {
        const templateId = env.subscriptionTemplates[item.key]
        const platformStatus = templateId ? itemSettings[templateId] || '' : ''
        return Object.assign({}, item, {
          platformBlocked: mainSwitchOff || platformStatus === 'reject' || platformStatus === 'ban',
          platformStatus: platformStatus,
          enabled: item.status === 'accept' && !(mainSwitchOff || platformStatus === 'reject' || platformStatus === 'ban'),
          rejected: item.status === 'reject' || item.status === 'ban'
        })
      })
      this.setData({ items: items, mainSwitchOff: mainSwitchOff })
    } catch (error) {}
  },

  saveResult: async function (key, status) {
    const preferences = {}
    preferences[key] = status
    await repository.saveNotificationPreferences(preferences)
    const items = this.data.items.map(function (item) {
      return item.key === key ? Object.assign({}, item, {
        status: status,
        enabled: status === 'accept' && !item.platformBlocked,
        rejected: status === 'reject' || status === 'ban'
      }) : item
    })
    this.setData({ items: items })
  },

  requestSubscription: function (templateId) {
    return new Promise(function (resolve, reject) {
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success: resolve,
        fail: reject
      })
    })
  },

  openSettingsModal: function (message) {
    const page = this
    wx.showModal({
      title: '提醒未开启',
      content: message || '你可能已拒绝该订阅消息。可以前往微信设置重新允许通知。',
      confirmText: '去设置',
      cancelText: '稍后再说',
      success: function (result) {
        if (result.confirm) page.onOpenSettings()
      }
    })
  },

  onSubscribe: async function (event) {
    const key = event.currentTarget.dataset.key
    if (this.data.requestingKey) return
    const templateId = env.subscriptionTemplates[key]
    if (!templateId) {
      wx.showModal({
        title: '模板待配置',
        content: '需要先在微信公众平台添加订阅消息模板，并将模板ID填写到 config/env.js。',
        showCancel: false
      })
      return
    }

    const target = this.data.items.filter(function (item) { return item.key === key })[0]
    if (this.data.mainSwitchOff || target && target.platformBlocked) {
      this.openSettingsModal('微信中的订阅消息开关已关闭或该模板被设为拒绝，请前往设置后重新开启。')
      return
    }

    this.setData({ requestingKey: key })
    try {
      const result = await this.requestSubscription(templateId)
      const status = result[templateId] || 'reject'
      await this.saveResult(key, status)
      await this.refreshPlatformSetting()
      if (status === 'accept') {
        wx.showToast({ title: '已获得一次提醒授权', icon: 'success' })
      } else if (status === 'ban') {
        this.openSettingsModal('微信已禁止该订阅消息，请在设置中重新开启。')
      } else {
        this.openSettingsModal('本次选择了拒绝。如果再次点击仍不弹出授权框，请前往微信设置重新开启。')
      }
    } catch (error) {
      const message = String(error && error.errMsg || error && error.message || '')
      if (message.indexOf('20004') >= 0 || message.indexOf('deny') >= 0 || message.indexOf('ban') >= 0) {
        this.openSettingsModal('微信订阅消息总开关或当前模板已关闭，请前往设置重新开启。')
      } else {
        wx.showModal({
          title: '订阅请求未完成',
          content: message || '请稍后重试；如果授权框不再出现，可点击页面底部“打开微信通知设置”。',
          showCancel: false
        })
      }
    } finally {
      this.setData({ requestingKey: '' })
    }
  },

  onOpenSettings: function () {
    const page = this
    wx.openSetting({
      withSubscriptions: true,
      success: async function () {
        await page.refreshPlatformSetting()
      },
      fail: function () {
        wx.showToast({ title: '无法打开设置，请从小程序右上角进入设置', icon: 'none' })
      }
    })
  }
})
