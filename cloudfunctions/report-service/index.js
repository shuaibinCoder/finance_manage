const cloud = require('wx-server-sdk')
const reportUtils = require('./lib/report')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const command = db.command

const COLLECTIONS = {
  companies: 'companies',
  members: 'company_members',
  reports: 'monthly_reports',
  versions: 'report_versions',
  audits: 'audit_logs'
}

function ok(data) {
  return { success: true, data: data == null ? null : data }
}

function fail(code, message, details) {
  return { success: false, code: code, message: message, details: details || null }
}

function withoutId(value) {
  const data = Object.assign({}, value)
  delete data._id
  return data
}

function now() {
  return Date.now()
}

function currentMonth() {
  return reportUtils.currentMonth()
}

function validateMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))
}

function normalizeCents(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number)
}

function amountKeys(sections) {
  const keys = []
  sections.forEach(function (section) {
    section.fields.forEach(function (field) { keys.push(field.key) })
  })
  return keys
}

const BALANCE_KEYS = amountKeys(reportUtils.BALANCE_SECTIONS)
const PROFIT_KEYS = amountKeys(reportUtils.PROFIT_SECTIONS)

function sanitizeAmounts(source, keys) {
  const result = {}
  keys.forEach(function (key) {
    result[key] = normalizeCents(source && source[key])
  })
  return result
}

function sanitizeReport(report, companyId, openid) {
  const month = String(report && report.month || '')
  if (!validateMonth(month)) throw businessError('INVALID_MONTH', '月份格式不正确')
  return {
    _id: companyId + '_' + month,
    companyId: companyId,
    month: month,
    status: report && report.status === 'confirmed' ? 'confirmed' : 'draft',
    balance: sanitizeAmounts(report && report.balance, BALANCE_KEYS),
    profit: sanitizeAmounts(report && report.profit, PROFIT_KEYS),
    updatedBy: openid
  }
}

function sanitizeCompany(company) {
  const name = String(company && company.name || '').trim().slice(0, 40)
  if (!name) throw businessError('INVALID_COMPANY', '企业名称不能为空')
  const industry = String(company && company.industry || '其他行业').trim().slice(0, 30)
  const startMonth = String(company && company.startMonth || currentMonth())
  if (!validateMonth(startMonth)) throw businessError('INVALID_MONTH', '启用月份格式不正确')
  if (startMonth > currentMonth()) throw businessError('INVALID_MONTH', '启用月份不能晚于当前月份')
  return { name: name, industry: industry, startMonth: startMonth }
}

function businessError(code, message, details) {
  const error = new Error(message)
  error.businessCode = code
  error.details = details
  return error
}

async function getDocument(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get()
    return result.data || null
  } catch (error) {
    const message = String(error && error.message || '').toLowerCase()
    if (message.indexOf('document') >= 0 && message.indexOf('not exist') >= 0) return null
    throw error
  }
}

async function getMembership(openid, companyId) {
  if (companyId) {
    return getDocument(COLLECTIONS.members, companyId + '_' + openid)
  }
  const result = await db.collection(COLLECTIONS.members)
    .where({ openid: openid })
    .limit(20)
    .get()
  const members = result.data || []
  for (let i = 0; i < members.length; i++) {
    if (members[i].status === 'active') return members[i]
  }
  return null
}

async function requireMembership(openid, companyId, roles) {
  const membership = await getMembership(openid, companyId)
  if (!membership || membership.status !== 'active') {
    throw businessError('FORBIDDEN', '你没有该企业的数据权限')
  }
  if (roles && roles.length && roles.indexOf(membership.role) < 0) {
    throw businessError('FORBIDDEN', '当前角色没有执行此操作的权限')
  }
  return membership
}

async function getCurrentCompany(openid) {
  const membership = await getMembership(openid)
  if (!membership) return null
  return getDocument(COLLECTIONS.companies, membership.companyId)
}

async function addAudit(companyId, openid, action, targetId, before, after) {
  return db.collection(COLLECTIONS.audits).add({
    data: {
      companyId: companyId,
      operatorOpenid: openid,
      action: action,
      targetId: targetId || '',
      before: before || null,
      after: after || null,
      createdAt: now()
    }
  })
}

async function createCompany(openid, input) {
  const companyData = sanitizeCompany(input)
  const companyId = 'company_' + openid.slice(-8) + '_' + now()
  const company = Object.assign({}, companyData, {
    _id: companyId,
    ownerOpenid: openid,
    status: 'active',
    createdAt: now(),
    updatedAt: now()
  })
  await db.collection(COLLECTIONS.companies).doc(companyId).set({ data: withoutId(company) })
  await db.collection(COLLECTIONS.members).doc(companyId + '_' + openid).set({
    data: {
      companyId: companyId,
      openid: openid,
      role: 'owner',
      status: 'active',
      createdAt: now()
    }
  })
  await addAudit(companyId, openid, 'COMPANY_CREATE', companyId, null, company)
  return company
}

async function saveCompany(openid, input) {
  const existing = await getCurrentCompany(openid)
  if (!existing) return createCompany(openid, input)
  await requireMembership(openid, existing._id, ['owner'])
  const companyData = sanitizeCompany(input)
  const updated = Object.assign({}, existing, companyData, { updatedAt: now() })
  await db.collection(COLLECTIONS.companies).doc(existing._id).update({
    data: Object.assign({}, companyData, { updatedAt: updated.updatedAt })
  })
  await addAudit(existing._id, openid, 'COMPANY_UPDATE', existing._id, existing, updated)
  return updated
}

async function getReport(openid, month) {
  if (!validateMonth(month)) throw businessError('INVALID_MONTH', '月份格式不正确')
  const company = await getCurrentCompany(openid)
  if (!company) return null
  await requireMembership(openid, company._id)
  return getDocument(COLLECTIONS.reports, company._id + '_' + month)
}

async function listReports(openid) {
  const company = await getCurrentCompany(openid)
  if (!company) return []
  await requireMembership(openid, company._id)
  const result = await db.collection(COLLECTIONS.reports)
    .where({ companyId: company._id })
    .limit(100)
    .get()
  return (result.data || []).sort(function (left, right) {
    return left.month < right.month ? 1 : -1
  })
}

async function saveReport(openid, input, expectedVersion) {
  const company = await getCurrentCompany(openid)
  if (!company) throw businessError('COMPANY_REQUIRED', '请先创建企业')
  await requireMembership(openid, company._id, ['owner', 'finance'])
  const sanitized = sanitizeReport(input, company._id, openid)
  if (sanitized.month < company.startMonth || sanitized.month > currentMonth()) {
    throw businessError('INVALID_MONTH', '填报月份超出企业启用范围')
  }
  const reportId = sanitized._id
  const existing = await getDocument(COLLECTIONS.reports, reportId)
  const currentVersion = existing ? Number(existing.version) || 1 : 0
  if (Number(expectedVersion) !== currentVersion) {
    throw businessError('VERSION_CONFLICT', '月报已被其他成员修改，请刷新后重试', {
      expectedVersion: Number(expectedVersion),
      currentVersion: currentVersion
    })
  }
  if (existing && existing.status === 'confirmed') {
    throw businessError('REPORT_LOCKED', '已确认月报不能直接修改')
  }
  const saved = Object.assign({}, sanitized, {
    status: 'draft',
    version: currentVersion + 1,
    createdAt: existing ? existing.createdAt : now(),
    createdBy: existing ? existing.createdBy : openid,
    updatedAt: now(),
    confirmedAt: 0,
    confirmedBy: ''
  })
  await db.collection(COLLECTIONS.reports).doc(reportId).set({ data: withoutId(saved) })
  await addAudit(company._id, openid, existing ? 'REPORT_UPDATE' : 'REPORT_CREATE', reportId, existing, saved)
  return saved
}

async function confirmReport(openid, month, expectedVersion) {
  const company = await getCurrentCompany(openid)
  if (!company) throw businessError('COMPANY_REQUIRED', '请先创建企业')
  await requireMembership(openid, company._id, ['owner', 'finance'])
  const reportId = company._id + '_' + month
  const existing = await getDocument(COLLECTIONS.reports, reportId)
  if (!existing) throw businessError('REPORT_NOT_FOUND', '本月暂无可确认的数据')
  if (Number(expectedVersion) !== Number(existing.version)) {
    throw businessError('VERSION_CONFLICT', '月报已被其他成员修改，请刷新后重试')
  }
  const validation = reportUtils.validateReport(existing)
  if (!validation.valid) throw businessError('REPORT_INVALID', '月报数据校验未通过', validation)
  const updated = Object.assign({}, existing, {
    status: 'confirmed',
    version: Number(existing.version) + 1,
    confirmedAt: now(),
    confirmedBy: openid,
    updatedAt: now(),
    updatedBy: openid
  })
  await db.collection(COLLECTIONS.reports).doc(reportId).set({ data: withoutId(updated) })
  await db.collection(COLLECTIONS.versions).add({
    data: {
      companyId: company._id,
      reportId: reportId,
      reportVersion: updated.version,
      operation: 'confirm',
      snapshot: updated,
      operatorOpenid: openid,
      createdAt: now()
    }
  })
  await addAudit(company._id, openid, 'REPORT_CONFIRM', reportId, existing, updated)
  return { report: updated, validation: validation }
}

async function reopenReport(openid, month, expectedVersion) {
  const company = await getCurrentCompany(openid)
  if (!company) throw businessError('COMPANY_REQUIRED', '请先创建企业')
  await requireMembership(openid, company._id, ['owner', 'finance'])
  const reportId = company._id + '_' + month
  const existing = await getDocument(COLLECTIONS.reports, reportId)
  if (!existing) throw businessError('REPORT_NOT_FOUND', '月报不存在')
  if (Number(expectedVersion) !== Number(existing.version)) {
    throw businessError('VERSION_CONFLICT', '月报已被其他成员修改，请刷新后重试')
  }
  const updated = Object.assign({}, existing, {
    status: 'draft',
    version: Number(existing.version) + 1,
    confirmedAt: 0,
    confirmedBy: '',
    updatedAt: now(),
    updatedBy: openid
  })
  await db.collection(COLLECTIONS.reports).doc(reportId).set({ data: withoutId(updated) })
  await db.collection(COLLECTIONS.versions).add({
    data: {
      companyId: company._id,
      reportId: reportId,
      reportVersion: updated.version,
      operation: 'reopen',
      snapshot: updated,
      operatorOpenid: openid,
      createdAt: now()
    }
  })
  await addAudit(company._id, openid, 'REPORT_REOPEN', reportId, existing, updated)
  return updated
}

async function copyPreviousMonth(openid, month) {
  const company = await getCurrentCompany(openid)
  if (!company) throw businessError('COMPANY_REQUIRED', '请先创建企业')
  await requireMembership(openid, company._id, ['owner', 'finance'])
  const previousMonth = reportUtils.shiftMonth(month, -1)
  const previous = await getDocument(COLLECTIONS.reports, company._id + '_' + previousMonth)
  if (!previous) throw businessError('PREVIOUS_REPORT_NOT_FOUND', '上月暂无可复制数据')
  const existing = await getDocument(COLLECTIONS.reports, company._id + '_' + month)
  if (existing && existing.status === 'confirmed') throw businessError('REPORT_LOCKED', '已确认月报不能覆盖')
  const copied = Object.assign({}, reportUtils.createEmptyReport(month), {
    _id: company._id + '_' + month,
    companyId: company._id,
    balance: sanitizeAmounts(previous.balance, BALANCE_KEYS),
    profit: sanitizeAmounts(previous.profit, PROFIT_KEYS),
    status: 'draft',
    version: existing ? Number(existing.version) + 1 : 1,
    createdAt: existing ? existing.createdAt : now(),
    createdBy: existing ? existing.createdBy : openid,
    updatedAt: now(),
    updatedBy: openid,
    confirmedAt: 0,
    confirmedBy: ''
  })
  await db.collection(COLLECTIONS.reports).doc(copied._id).set({ data: withoutId(copied) })
  await addAudit(company._id, openid, 'REPORT_COPY_PREVIOUS', copied._id, existing, copied)
  return copied
}

function buildDemoReports(companyId, openid) {
  const reports = []
  const current = currentMonth()
  for (let index = 5; index >= 0; index--) {
    const month = reportUtils.shiftMonth(current, -index)
    const step = 5 - index
    const revenue = (180000 + step * 13500) * 100
    const cost = Math.round(revenue * (0.58 + (step % 2) * 0.02))
    const report = reportUtils.createEmptyReport(month)
    report.profit.mainRevenue = revenue
    report.profit.mainCost = cost
    report.profit.taxesAndSurcharges = Math.round(revenue * 0.012)
    report.profit.sellingExpenses = (12000 + step * 800) * 100
    report.profit.adminExpenses = (18000 + step * 600) * 100
    report.profit.financeExpenses = (1800 + step * 150) * 100
    report.profit.otherIncome = step % 3 === 0 ? 300000 : 0
    report.profit.incomeTax = Math.max(Math.round(reportUtils.calculateProfit(report.profit).profitBeforeTax * 0.1), 0)
    const cash = (98000 + step * 11000) * 100
    const receivable = (62000 + step * 7000) * 100
    const inventory = (128000 + step * 5000) * 100
    Object.assign(report.balance, {
      cash: cash,
      accountsReceivable: receivable,
      inventory: inventory,
      otherCurrentAssets: 1800000,
      fixedAssets: 26000000 - step * 1200000,
      otherNonCurrentAssets: 6000000,
      shortTermLoans: 6000000,
      accountsPayable: (72000 + step * 3000) * 100,
      taxesPayable: 900000,
      otherCurrentLiabilities: 2200000,
      longTermLoans: 8000000,
      otherNonCurrentLiabilities: 1500000,
      paidInCapital: 20000000,
      otherEquity: 3000000
    })
    const balance = reportUtils.calculateBalance(report.balance)
    report.balance.retainedEarnings = balance.assets - balance.liabilities - report.balance.paidInCapital - report.balance.otherEquity
    report._id = companyId + '_' + month
    report.companyId = companyId
    report.status = index === 0 ? 'draft' : 'confirmed'
    report.version = 1
    report.createdAt = now()
    report.createdBy = openid
    report.updatedAt = now()
    report.updatedBy = openid
    report.confirmedAt = report.status === 'confirmed' ? now() : 0
    report.confirmedBy = report.status === 'confirmed' ? openid : ''
    reports.push(report)
  }
  return reports
}

async function seedDemoData(openid) {
  let company = await getCurrentCompany(openid)
  if (!company) {
    company = await createCompany(openid, {
      name: '柠月商贸有限公司',
      industry: '商贸零售',
      startMonth: reportUtils.shiftMonth(currentMonth(), -5)
    })
  }
  await requireMembership(openid, company._id, ['owner', 'finance'])
  const reports = buildDemoReports(company._id, openid)
  for (let i = 0; i < reports.length; i++) {
    await db.collection(COLLECTIONS.reports).doc(reports[i]._id).set({ data: withoutId(reports[i]) })
  }
  await addAudit(company._id, openid, 'DEMO_DATA_CREATE', company._id, null, { reportCount: reports.length })
  return { company: company, reports: reports }
}

async function migrateLocalState(openid, state) {
  const existing = await getCurrentCompany(openid)
  if (existing) return { company: existing, reports: await listReports(openid), migrated: false }
  if (!state || !state.company) throw businessError('NO_LOCAL_DATA', '没有可迁移的本地数据')
  const company = await createCompany(openid, state.company)
  const reports = []
  const sourceReports = state.reports || {}
  const months = Object.keys(sourceReports).sort()
  for (let i = 0; i < months.length; i++) {
    const sanitized = sanitizeReport(sourceReports[months[i]], company._id, openid)
    const saved = Object.assign({}, sanitized, {
      status: sourceReports[months[i]].status === 'confirmed' ? 'confirmed' : 'draft',
      version: Number(sourceReports[months[i]].version) || 1,
      createdAt: Number(sourceReports[months[i]].createdAt) || now(),
      createdBy: openid,
      updatedAt: now(),
      updatedBy: openid,
      confirmedAt: sourceReports[months[i]].status === 'confirmed' ? now() : 0,
      confirmedBy: sourceReports[months[i]].status === 'confirmed' ? openid : ''
    })
    await db.collection(COLLECTIONS.reports).doc(saved._id).set({ data: withoutId(saved) })
    reports.push(saved)
  }
  await addAudit(company._id, openid, 'LOCAL_DATA_MIGRATE', company._id, null, { reportCount: reports.length })
  return { company: company, reports: reports, migrated: true }
}

async function removeByCompany(collection, companyId) {
  return db.collection(collection).where({ companyId: companyId }).remove()
}

async function clearReports(openid) {
  const company = await getCurrentCompany(openid)
  if (!company) return true
  await requireMembership(openid, company._id, ['owner'])
  await removeByCompany(COLLECTIONS.reports, company._id)
  await removeByCompany(COLLECTIONS.versions, company._id)
  await addAudit(company._id, openid, 'REPORTS_CLEAR', company._id, null, null)
  return true
}

async function resetCompany(openid) {
  const company = await getCurrentCompany(openid)
  if (!company) return true
  await requireMembership(openid, company._id, ['owner'])
  await removeByCompany(COLLECTIONS.reports, company._id)
  await removeByCompany(COLLECTIONS.versions, company._id)
  await removeByCompany(COLLECTIONS.audits, company._id)
  await removeByCompany(COLLECTIONS.members, company._id)
  await db.collection(COLLECTIONS.companies).doc(company._id).remove()
  return true
}

async function exportData(openid) {
  const company = await getCurrentCompany(openid)
  if (!company) return { company: null, reports: [] }
  await requireMembership(openid, company._id)
  return { company: company, reports: await listReports(openid), exportedAt: now() }
}

exports.main = async function (event) {
  const context = cloud.getWXContext()
  const openid = context.OPENID
  const action = event && event.action

  try {
    if (!openid) throw businessError('UNAUTHORIZED', '无法获取微信用户身份')
    switch (action) {
      case 'ping':
        await Promise.all(Object.keys(COLLECTIONS).map(function (key) {
          return db.collection(COLLECTIONS[key]).limit(1).get()
        }))
        return ok({ available: true, envId: context.ENV, serverTime: now() })
      case 'getCompany':
        return ok(await getCurrentCompany(openid))
      case 'saveCompany':
        return ok(await saveCompany(openid, event.company))
      case 'getReport':
        return ok(await getReport(openid, event.month))
      case 'listReports':
        return ok(await listReports(openid))
      case 'saveReport':
        return ok(await saveReport(openid, event.report, event.expectedVersion))
      case 'confirmReport':
        return ok(await confirmReport(openid, event.month, event.expectedVersion))
      case 'reopenReport':
        return ok(await reopenReport(openid, event.month, event.expectedVersion))
      case 'copyPreviousMonth':
        return ok(await copyPreviousMonth(openid, event.month))
      case 'seedDemoData':
        return ok(await seedDemoData(openid))
      case 'migrateLocalState':
        return ok(await migrateLocalState(openid, event.state))
      case 'clearReports':
        return ok(await clearReports(openid))
      case 'resetCompany':
        return ok(await resetCompany(openid))
      case 'exportData':
        return ok(await exportData(openid))
      default:
        return fail('UNKNOWN_ACTION', '未知操作：' + action)
    }
  } catch (error) {
    console.error('report-service error', action, error)
    if (error && error.businessCode) return fail(error.businessCode, error.message, error.details)
    return fail('INTERNAL_ERROR', '云端服务异常，请稍后重试')
  }
}
