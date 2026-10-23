const env = require('../config/env')
const reportUtils = require('../utils/report')

const BUSINESS_CODES = [
  'INVALID_MONTH', 'INVALID_COMPANY', 'FORBIDDEN', 'UNAUTHORIZED',
  'COMPANY_REQUIRED', 'VERSION_CONFLICT', 'REPORT_LOCKED',
  'REPORT_NOT_FOUND', 'REPORT_INVALID', 'PREVIOUS_REPORT_NOT_FOUND',
  'NO_LOCAL_DATA', 'INVALID_PROFILE', 'INVALID_ROLE', 'INVITE_NOT_FOUND',
  'INVITE_EXPIRED', 'INVITE_USED', 'ALREADY_IN_COMPANY', 'MEMBER_NOT_FOUND',
  'OWNER_PROTECTED', 'INVALID_STATUS', 'RETURN_REASON_REQUIRED'
]

function cloudError(code, message, details) {
  const error = new Error(message || '云端请求失败')
  error.code = code || 'CLOUD_REQUEST_FAILED'
  error.details = details
  error.cloudBusiness = BUSINESS_CODES.indexOf(code) >= 0
  return error
}

function call(action, data) {
  return wx.cloud.callFunction({
    name: env.cloudFunctionName,
    config: { env: env.cloudEnvId },
    data: Object.assign({ action: action }, data || {})
  }).then(function (response) {
    const result = response && response.result
    if (!result || result.success !== true) {
      throw cloudError(
        result && result.code,
        result && result.message ? result.message : '云函数返回异常',
        result && result.details
      )
    }
    return result.data
  }).catch(function (error) {
    if (error && error.cloudBusiness) throw error
    const wrapped = cloudError('CLOUD_REQUEST_FAILED', error && error.message ? error.message : '无法连接云端')
    wrapped.originalError = error
    wrapped.cloudBusiness = false
    throw wrapped
  })
}

function normalizeReport(saved, month) {
  const empty = reportUtils.createEmptyReport(month)
  if (!saved) {
    empty._exists = false
    return empty
  }
  return Object.assign(empty, saved, {
    month: month,
    balance: Object.assign({}, empty.balance, saved.balance || {}),
    profit: Object.assign({}, empty.profit, saved.profit || {}),
    _exists: true
  })
}


function getSession() {
  return call('getSession')
}

function saveUserProfile(profile) {
  return call('saveUserProfile', { profile: profile })
}

function listMembers() {
  return call('listMembers')
}

function updateMemberRole(memberId, role) {
  return call('updateMemberRole', { memberId: memberId, role: role })
}

function removeMember(memberId) {
  return call('removeMember', { memberId: memberId })
}

function createInvite(role, validHours) {
  return call('createInvite', { role: role, validHours: validHours })
}

function getInvitePreview(token) {
  return call('getInvitePreview', { token: token })
}

function acceptInvite(token) {
  return call('acceptInvite', { token: token })
}

function getNotificationPreferences() {
  return call('getNotificationPreferences')
}

function saveNotificationPreferences(preferences) {
  return call('saveNotificationPreferences', { preferences: preferences })
}

function getCompany() {
  return call('getCompany')
}

function saveCompany(company) {
  return call('saveCompany', { company: company })
}

function getReport(month) {
  return call('getReport', { month: month }).then(function (report) {
    return normalizeReport(report, month)
  })
}

function listReports() {
  return call('listReports').then(function (reports) {
    return (reports || []).map(function (report) {
      return normalizeReport(report, report.month)
    })
  })
}

function saveReport(report) {
  return call('saveReport', {
    report: report,
    expectedVersion: report._exists ? report.version : 0
  }).then(function (saved) {
    return normalizeReport(saved, saved.month)
  })
}


function submitReport(month, expectedVersion) {
  return call('submitReport', { month: month, expectedVersion: expectedVersion })
    .then(function (result) {
      return {
        success: true,
        report: normalizeReport(result.report, month),
        validation: result.validation,
        notification: result.notification || null
      }
    })
}

function returnReport(month, expectedVersion, reason) {
  return call('returnReport', { month: month, expectedVersion: expectedVersion, reason: reason })
    .then(function (saved) { return normalizeReport(saved, month) })
}

function confirmReport(month, expectedVersion) {
  return call('confirmReport', { month: month, expectedVersion: expectedVersion })
    .then(function (result) {
      return {
        success: true,
        report: normalizeReport(result.report, month),
        validation: result.validation
      }
    })
}

function reopenReport(month, expectedVersion) {
  return call('reopenReport', { month: month, expectedVersion: expectedVersion })
    .then(function (saved) { return normalizeReport(saved, month) })
}

function copyPreviousMonth(month) {
  return call('copyPreviousMonth', { month: month })
    .then(function (saved) { return normalizeReport(saved, month) })
}

function clearReports() {
  return call('clearReports')
}

function resetCompany() {
  return call('resetCompany')
}

function exportData() {
  return call('exportData').then(function (data) {
    return JSON.stringify(data, null, 2)
  })
}

function seedDemoData() {
  return call('seedDemoData')
}

function migrateLocalState(state) {
  return call('migrateLocalState', { state: state })
}

function ping() {
  return call('ping')
}

module.exports = {
  getSession: getSession,
  saveUserProfile: saveUserProfile,
  listMembers: listMembers,
  updateMemberRole: updateMemberRole,
  removeMember: removeMember,
  createInvite: createInvite,
  getInvitePreview: getInvitePreview,
  acceptInvite: acceptInvite,
  getNotificationPreferences: getNotificationPreferences,
  saveNotificationPreferences: saveNotificationPreferences,
  getCompany: getCompany,
  saveCompany: saveCompany,
  getReport: getReport,
  listReports: listReports,
  saveReport: saveReport,
  submitReport: submitReport,
  returnReport: returnReport,
  confirmReport: confirmReport,
  reopenReport: reopenReport,
  copyPreviousMonth: copyPreviousMonth,
  clearReports: clearReports,
  resetCompany: resetCompany,
  exportData: exportData,
  seedDemoData: seedDemoData,
  migrateLocalState: migrateLocalState,
  ping: ping
}
