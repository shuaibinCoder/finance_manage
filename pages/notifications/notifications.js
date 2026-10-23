const repository = require('../../repositories/report-repository')
const env = require('../../config/env')

Page({
  data: {
    items: [
      { key: 'reportPending', label: '月报待确认', desc: '财务提交月报后提醒老板处理', configured: false, status: '' },
      { key: 'reportReturned', label: '月报被退回', desc: '老板退回月报后提醒财务修改', configured: false, status: '' },
      { key: 'reportConfirmed', label: '月报已确认', desc: '月报确认完成后通知相关成员', configured: false, status: '' }
    ],
    loading: true
  },

  onLoad: async function () {
    try {
      const saved = await repository.getNotificationPreferences()
      const preferences = saved.preferences || {}
      const items = this.data.items.map(function (item) {
        return Object.assign({}, item, {
          configured: Boolean(env.subscriptionTemplates[item.key]),
          status: preferences[item.key] || ''
        })
      })
      this.setData({ items: items, loading: false })
    } catch (error) {
      const items = this.data.items.map(function (item) {
        return Object.assign({}, item, { configured: Boolean(env.subscriptionTemplates[item.key]) })
      })
      this.setData({ items: items, loading: false })
    }
  },

  onSubscribe: async function (event) {
    const key = event.currentTarget.dataset.key
    const templateId = env.subscriptionTemplates[key]
    if (!templateId) {
      wx.showModal({
        title: '模板待配置',
        content: '需要先在微信公众平台添加订阅消息模板，并将模板ID填写到 config/env.js。',
        showCancel: false
      })
      return
    }
    try {
      const result = await wx.requestSubscribeMessage({ tmplIds: [templateId] })
      const status = result[templateId] || 'reject'
      const preferences = {}
      preferences[key] = status
      await repository.saveNotificationPreferences(preferences)
      const items = this.data.items.map(function (item) {
        return item.key === key ? Object.assign({}, item, { status: status }) : item
      })
      this.setData({ items: items })
      wx.showToast({ title: status === 'accept' ? '提醒已授权' : '未开启提醒', icon: 'none' })
    } catch (error) {
      wx.showToast({ title: '订阅请求未完成', icon: 'none' })
    }
  }
})
