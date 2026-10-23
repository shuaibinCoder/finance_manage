const repository = require('../../repositories/report-repository')

Page({
  data: {
    members: [],
    isOwner: false,
    loading: true
  },

  onShow: async function () {
    try {
      const results = await Promise.all([repository.getSession(), repository.listMembers()])
      this.setData({
        members: results[1].map(function (item) {
          const isOwner = results[0].membership && results[0].membership.role === 'owner'
          return Object.assign({}, item, {
            initial: String(item.displayName || '财').slice(0, 1),
            canManage: Boolean(isOwner && !item.isSelf && item.role !== 'owner')
          })
        }),
        isOwner: results[0].membership && results[0].membership.role === 'owner',
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '成员加载失败', icon: 'none' })
    }
  },

  onInvite: function () {
    wx.navigateTo({ url: '/pages/invite-create/invite-create' })
  },

  onMemberAction: function (event) {
    if (!this.data.isOwner) return
    const member = event.currentTarget.dataset.member
    if (member.isSelf || member.role === 'owner') return
    const roles = ['财务人员', '老板', '查看者', '移除成员']
    const roleValues = ['finance', 'boss', 'viewer', 'remove']
    const page = this
    wx.showActionSheet({
      itemList: roles,
      success: async function (result) {
        const value = roleValues[result.tapIndex]
        try {
          if (value === 'remove') {
            const confirmed = await new Promise(function (resolve) {
              wx.showModal({
                title: '移除成员',
                content: '确认将“' + member.displayName + '”移出企业？',
                confirmColor: '#d9485f',
                success: function (modal) { resolve(modal.confirm) }
              })
            })
            if (!confirmed) return
            await repository.removeMember(member.id)
          } else {
            await repository.updateMemberRole(member.id, value)
          }
          await page.onShow()
          wx.showToast({ title: '成员已更新', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: error.message || '操作失败', icon: 'none' })
        }
      }
    })
  }
})
