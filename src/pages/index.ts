import { type PageDefinition } from '../types.js'
import { home } from './home.js'
import { jobsList } from './jobs-list.js'
import { jobsApplicants } from './jobs-applicants.js'
import { workOrders } from './work-orders.js'
import { jobDetail } from './job-detail.js'
import { candidatesList } from './candidates-list.js'
import { candidateTimesheets } from './candidate-timesheets.js'
import { candidateTimesheetsMobileAllocation } from './candidate-timesheets-mobile-allocation.js'
import { candidateTimesheetsMobileDay } from './candidate-timesheets-mobile-day.js'
import { vendorAppliedCandidates } from './vendor-applied-candidates.js'
import { expenses } from './expenses.js'
import { expensesDetail } from './expenses-detail.js'
import { timeEntries } from './time-entries.js'
import { candidatesDetail } from './candidates-detail.js'
import { workOrderDetail } from './work-order-detail.js'
import { workOrderModify } from './work-order-modify.js'
import { vendorCandidateDetail } from './vendor-candidate-detail.js'
import { jobsApplicantsDetail } from './jobs-applicants-detail.js'
import { jobsApplicantsOffer } from './jobs-applicants-offer.js'
import { jobsApplicantsOnboard } from './jobs-applicants-onboard.js'
import { jobEdit } from './job-edit.js'
import { sow } from './sow.js'
import { sowDetail } from './sow-detail.js'
import { timesheetsWeek } from './timesheets-week.js'
import { timesheetsMonth } from './timesheets-month.js'
import { contractors } from './contractors.js'
import { reporting } from './reporting.js'
import { settingsSecurity } from './settings-security.js'
import { contractorDetail } from './contractor-detail.js'
import { approvals } from './approvals.js'
import { invoicesSummary } from './invoices-summary.js'
import { checklistActions } from './checklist-actions.js'
import { jobInterviewManagement } from './job-interview-management.js'
import { settingsUsers } from './settings-users.js'
import { settingsDirectory } from './settings-directory.js'
import { settingsGenericFields } from './settings-generic-fields.js'
import { notificationPreferences } from './notification-preferences.js'

/**
 * Registry of all pages to capture.
 * Each page file exports a PageDefinition with route mocks and setup logic.
 *
 * Add new pages here as they are implemented.
 */
export const pageRegistry: PageDefinition[] = [
  home,
  jobsList,
  jobsApplicants,
  jobsApplicantsDetail,
  jobsApplicantsOffer,
  jobsApplicantsOnboard,
  jobDetail,
  jobEdit,
  workOrders,
  workOrderDetail,
  workOrderModify,
  candidatesList,
  candidateTimesheets,
  candidateTimesheetsMobileAllocation,
  candidateTimesheetsMobileDay,
  vendorAppliedCandidates,
  expenses,
  expensesDetail,
  timeEntries,
  candidatesDetail,
  vendorCandidateDetail,
  sow,
  sowDetail,
  timesheetsWeek,
  timesheetsMonth,
  contractors,
  reporting,
  settingsSecurity,
  contractorDetail,
  approvals,
  invoicesSummary,
  checklistActions,
  jobInterviewManagement,
  settingsUsers,
  settingsDirectory,
  settingsGenericFields,
  notificationPreferences,
]
