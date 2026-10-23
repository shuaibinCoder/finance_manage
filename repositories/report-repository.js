const env = require('../config/env')
const local = require('../utils/store')
const cloud = require('./cloud-report-repository')

let runtimeMode = 'cloud'
let lastError = ''
let migrationAttempted = false

function markCloudFailure(error) {
  runtimeMode = 'local-fallback'
  lastError = error && error.message ? error.message : '云端环境不可用'
}

function isBusinessError(error) {
  return Boolean(error && error.cloudBusiness)
}

function localReport(month) {
  const report = local.getReport(month)
  report._exists = local.hasReport(month)
  return report
}

function invoke(remoteCall, localCall) {
  if (runtimeMode === 'local-fallback') {
    return Promise.resolve().then(localCall)
  }
  return Promise.resolve().then(remoteCall).catch(function (error) {
    if (isBusinessError(error)) throw error
    markCloudFailure(error)
    return localCall()
  })
}

function getCompany() {
  return invoke(function () {
    return cloud.getCompany().then(function (company) {
      if (company) {
        local.cacheCompany(company)
        return company
      }
      const localState = local.getState()
      if (!migrationAttempted && localState.company) {
        migrationAttempted = true
        return cloud.migrateLocalState(localState).then(function (result) {
          const migrated = result && result.company
          if (migrated) local.cacheCompany(migrated)
          if (result && result.reports) local.cacheReports(result.reports)
          return migrated || null
        })
      }
      return null
    })
  }, function () {
    return local.getCompany()
  })
}

function saveCompany(company) {
  return invoke(function () {
    return cloud.saveCompany(company).then(function (saved) {
      local.cacheCompany(saved)
      return saved
    })
  }, function () {
    return local.setCompany(company)
  })
}

function getActiveMonth() {
  return local.getActiveMonth()
}

function setActiveMonth(month) {
  local.setActiveMonth(month)
}

function getReport(month) {
  return invoke(function () {
    return cloud.getReport(month).then(function (report) {
      if (report._exists) local.cacheReport(report)
      return report
    })
  }, function () {
    return localReport(month)
  })
}

function listReports() {
  return invoke(function () {
    return cloud.listReports().then(function (reports) {
      local.cacheReports(reports)
      return reports
    })
  }, function () {
    return local.listReports().map(function (report) {
      report._exists = true
      return report
    })
  })
}

function saveReport(report) {
  return invoke(function () {
    return cloud.saveReport(report).then(function (saved) {
      local.cacheReport(saved)
      return saved
    })
  }, function () {
    const saved = local.saveReport(report)
    saved._exists = true
    return saved
  })
}

function confirmReport(month, expectedVersion) {
  return invoke(function () {
    return cloud.confirmReport(month, expectedVersion).then(function (result) {
      if (result.report) local.cacheReport(result.report)
      return result
    }).catch(function (error) {
      if (error && error.code === 'REPORT_INVALID') {
        return { success: false, validation: error.details }
      }
      throw error
    })
  }, function () {
    const result = local.confirmReport(month)
    if (result.report) result.report._exists = true
    return result
  })
}

function reopenReport(month, expectedVersion) {
  return invoke(function () {
    return cloud.reopenReport(month, expectedVersion).then(function (saved) {
      local.cacheReport(saved)
      return saved
    })
  }, function () {
    const saved = local.reopenReport(month)
    saved._exists = true
    return saved
  })
}

function copyPreviousMonth(month) {
  return invoke(function () {
    return cloud.copyPreviousMonth(month).then(function (saved) {
      local.cacheReport(saved)
      return saved
    })
  }, function () {
    const saved = local.copyPreviousMonth(month)
    if (saved) saved._exists = true
    return saved
  })
}

function hasReport(month) {
  if (runtimeMode === 'local-fallback') return Promise.resolve(local.hasReport(month))
  return getReport(month).then(function (report) { return report._exists })
}

function clearReports() {
  return invoke(function () {
    return cloud.clearReports().then(function () {
      local.clearReports()
      return true
    })
  }, function () {
    local.clearReports()
    return true
  })
}

function clearAll() {
  return invoke(function () {
    return cloud.resetCompany().then(function () {
      local.clearAll()
      return true
    })
  }, function () {
    local.clearAll()
    return true
  })
}

function exportData() {
  return invoke(function () {
    return cloud.exportData()
  }, function () {
    return local.exportData()
  })
}

function seedDemoData() {
  return invoke(function () {
    return cloud.seedDemoData().then(function (result) {
      if (result.company) local.cacheCompany(result.company)
      if (result.reports) local.cacheReports(result.reports)
      return result
    })
  }, function () {
    return local.seedDemoData()
  })
}

function checkCloud() {
  runtimeMode = 'cloud'
  lastError = ''
  return cloud.ping().then(function (result) {
    return result
  }).catch(function (error) {
    markCloudFailure(error)
    throw error
  })
}

function getStatus() {
  return {
    mode: runtimeMode,
    envId: env.cloudEnvId,
    lastError: lastError
  }
}

module.exports = {
  getCompany: getCompany,
  saveCompany: saveCompany,
  getActiveMonth: getActiveMonth,
  setActiveMonth: setActiveMonth,
  getReport: getReport,
  listReports: listReports,
  saveReport: saveReport,
  confirmReport: confirmReport,
  reopenReport: reopenReport,
  copyPreviousMonth: copyPreviousMonth,
  hasReport: hasReport,
  clearReports: clearReports,
  clearAll: clearAll,
  exportData: exportData,
  seedDemoData: seedDemoData,
  checkCloud: checkCloud,
  getStatus: getStatus
}
