const repository = require('../../repositories/report-repository')
const env = require('../../config/env')

Page({
  data: {
    displayName: '',
    avatarFileId: '',
    avatarPreview: '',
    roleLabel: '',
    saving: false
  },

  onLoad: async function (options) {
    this.next = options && options.next || ''
    try {
      const session = await repository.getSession()
      this.setData({
        displayName: session.user && session.user.displayName || '',
        avatarFileId: session.user && session.user.avatarFileId || '',
        avatarPreview: session.user && session.user.avatarFileId || '',
        roleLabel: session.membership && session.membership.roleLabel || '未加入企业'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '资料加载失败', icon: 'none' })
    }
  },

  onNameInput: function (event) {
    this.setData({ displayName: event.detail.value })
  },

  onChooseAvatar: function (event) {
    const path = event.detail.avatarUrl
    this.setData({ avatarPreview: path })
    this.pendingAvatarPath = path
  },

  uploadAvatar: async function () {
    if (!this.pendingAvatarPath) return this.data.avatarFileId
    const extensionMatch = this.pendingAvatarPath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    const extension = extensionMatch ? extensionMatch[1] : 'png'
    const result = await wx.cloud.uploadFile({
      cloudPath: 'avatars/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + extension,
      filePath: this.pendingAvatarPath,
      config: { env: env.cloudEnvId }
    })
    return result.fileID
  },

  onSave: async function () {
    if (this.data.saving) return
    const displayName = String(this.data.displayName || '').trim()
    if (!displayName) {
      wx.showToast({ title: '请输入成员姓名', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const avatarFileId = await this.uploadAvatar()
      await repository.saveUserProfile({ displayName: displayName, avatarFileId: avatarFileId })
      wx.showToast({ title: '资料已保存', icon: 'success' })
      const next = this.next
      setTimeout(function () {
        if (next === 'home') wx.switchTab({ url: '/pages/index/index' })
        else wx.navigateBack()
      }, 400)
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
