// CONFIGURATION
const CONFIG = {
  CONTENT_PLANNER: {
    ID: '1HfFmOx8iGWvA_XEWvz8RSBMxxbOZKCA459fOkD1JT_E',
    SHEET_NAME: 'Content Planner',
    DATA_START_ROW: 17,
    COLUMNS: { NO: 0, TASK: 1, PLATFORM: 2, FORMAT: 3, ASSIGNED_TO: 4, DUE_DATE: 5, DATE_LEFT: 6, IN_PROGRESS: 7, REFERENCE: 8, RESULT: 9, NOTES: 10 }
  },
  PRESTASI: {
    ID: '1tbfeEDE4EY7OuE0MRKNYQ7SreRpeMa_GbckdVui1frE',
    SHEET_NAME: 'Form Responses 1',
    COLUMNS: { TIMESTAMP: 0, EMAIL: 1, NAMA: 2, NPM: 3, KEGIATAN: 4, PENYELENGGARA: 5, TINGKAT: 6, CAPAIAN: 7, BUKTI: 8, BIMBINGAN: 9, DOSEN: 10, SURAT: 11 }
  },
  MEDIA_PARTNER: {
    ID: '1e_FaJw2Csq67PmifCf0ajfWXZHhkSEPO8u0LnquZlqc',
    SHEET_NAME: 'Form Responses 1',
    COLUMNS: { TIMESTAMP: 0, NAMA: 1, WA: 2, INSTANSI: 3, KEGIATAN: 4, PROPOSAL: 5, SURAT: 6, PUBLIKASI: 7 }
  }
};

function doGet(e) {
  try {
    const action = e.parameter.action || 'getTasks';
    const callback = e.parameter.callback;

    let result;
    switch (action) {
      case 'getTasks': result = getTasksData(); break;
      case 'getPrestasi': result = getPrestasiData(); break;
      case 'getMediaPartner': result = getMediaPartnerData(); break;
      case 'createTask': result = createTaskData(JSON.parse(e.parameter.data || '{}')); break;
      case 'updateTask': result = updateTaskData(parseInt(e.parameter.id, 10), JSON.parse(e.parameter.data || '{}')); break;
      case 'deleteTask': result = deleteTaskData(parseInt(e.parameter.id, 10)); break;
      default: result = { error: 'Invalid action' };
    }
    return buildResponse(result, callback);
  } catch (error) {
    return buildResponse({ error: error.message }, e && e.parameter && e.parameter.callback);
  }
}

function buildResponse(data, callback) {
  const payload = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + payload + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

// CONTENT PLANNER FUNCTIONS
function getTasksData() {
  const cfg = CONFIG.CONTENT_PLANNER;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < cfg.DATA_START_ROW) return [];
  
  const values = sheet.getRange(cfg.DATA_START_ROW, 1, lastRow - cfg.DATA_START_ROW + 1, 11).getValues();
  return values.map((row, index) => ({
    no: row[cfg.COLUMNS.NO] || cfg.DATA_START_ROW + index,
    task: row[cfg.COLUMNS.TASK] || '',
    platform: row[cfg.COLUMNS.PLATFORM] || '',
    format: row[cfg.COLUMNS.FORMAT] || '',
    assignedTo: row[cfg.COLUMNS.ASSIGNED_TO] || '',
    dueDate: row[cfg.COLUMNS.DUE_DATE] ? formatDate(row[cfg.COLUMNS.DUE_DATE]) : '',
    dateLeft: row[cfg.COLUMNS.DATE_LEFT] || 0,
    inProgress: row[cfg.COLUMNS.IN_PROGRESS] || '',
    reference: row[cfg.COLUMNS.REFERENCE] || '',
    result: row[cfg.COLUMNS.RESULT] || '',
    notes: row[cfg.COLUMNS.NOTES] || ''
  }));
}

// PRESTASI FUNCTIONS
function getPrestasiData() {
  const cfg = CONFIG.PRESTASI;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  return values.map(row => ({
    timestamp: formatDate(row[cfg.COLUMNS.TIMESTAMP]),
    email: row[cfg.COLUMNS.EMAIL],
    nama: row[cfg.COLUMNS.NAMA],
    npm: row[cfg.COLUMNS.NPM],
    kegiatan: row[cfg.COLUMNS.KEGIATAN],
    penyelenggara: row[cfg.COLUMNS.PENYELENGGARA],
    tingkat: row[cfg.COLUMNS.TINGKAT],
    capaian: row[cfg.COLUMNS.CAPAIAN],
    bukti: row[cfg.COLUMNS.BUKTI],
    bimbingan: row[cfg.COLUMNS.BIMBINGAN],
    dosen: row[cfg.COLUMNS.DOSEN],
    surat: row[cfg.COLUMNS.SURAT]
  }));
}

// MEDIA PARTNER FUNCTIONS
function getMediaPartnerData() {
  const cfg = CONFIG.MEDIA_PARTNER;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  return values.map(row => ({
    timestamp: formatDate(row[cfg.COLUMNS.TIMESTAMP]),
    nama: row[cfg.COLUMNS.NAMA],
    wa: row[cfg.COLUMNS.WA],
    instansi: row[cfg.COLUMNS.INSTANSI],
    kegiatan: row[cfg.COLUMNS.KEGIATAN],
    proposal: row[cfg.COLUMNS.PROPOSAL],
    surat: row[cfg.COLUMNS.SURAT],
    publikasi: row[cfg.COLUMNS.PUBLIKASI]
  }));
}

function createTaskData(taskData) {
  const cfg = CONFIG.CONTENT_PLANNER;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const lastRow = sheet.getLastRow();
    let lastNumber = 0;
    let lastNumberRow = cfg.DATA_START_ROW - 1;
    
    if (lastRow >= cfg.DATA_START_ROW) {
      for (let row = lastRow; row >= cfg.DATA_START_ROW; row--) {
        const val = sheet.getRange(row, 1).getValue();
        if (!isNaN(val) && val > 0) { lastNumber = val; lastNumberRow = row; break; }
      }
    }
    
    const writeRow = lastNumberRow + 1;
    const newNo = lastNumber + 1;
    const dueDate = new Date((taskData.dueDate || '') + 'T00:00:00');
    
    sheet.getRange(writeRow, 1, 1, 11).setValues([[
      newNo, taskData.task || '', taskData.platform || '', taskData.format || '', 
      taskData.assignedTo || '', dueDate, '', taskData.inProgress || 'Not Done',
      taskData.reference || '', taskData.result || '', taskData.notes || ''
    ]]);
    sheet.getRange(writeRow, 6).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(writeRow, 7).setFormula(`=F${writeRow}-TODAY()`);
    
    return { success: true, no: newNo };
  } finally {
    lock.releaseLock();
  }
}

function updateTaskData(id, taskData) {
  const cfg = CONFIG.CONTENT_PLANNER;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const lastRow = sheet.getLastRow();
    for (let row = cfg.DATA_START_ROW; row <= lastRow; row++) {
      if (sheet.getRange(row, 1).getValue() == id) {
        if (taskData.task !== undefined) sheet.getRange(row, 2).setValue(taskData.task);
        if (taskData.platform !== undefined) sheet.getRange(row, 3).setValue(taskData.platform);
        if (taskData.format !== undefined) sheet.getRange(row, 4).setValue(taskData.format);
        if (taskData.assignedTo !== undefined) sheet.getRange(row, 5).setValue(taskData.assignedTo);
        if (taskData.dueDate !== undefined) {
          const d = new Date(taskData.dueDate + 'T00:00:00');
          sheet.getRange(row, 6).setValue(d).setNumberFormat('yyyy-mm-dd');
          sheet.getRange(row, 7).setFormula(`=F${row}-TODAY()`);
        }
        if (taskData.inProgress !== undefined) sheet.getRange(row, 8).setValue(taskData.inProgress);
        if (taskData.reference !== undefined) sheet.getRange(row, 9).setValue(taskData.reference);
        if (taskData.result !== undefined) sheet.getRange(row, 10).setValue(taskData.result);
        if (taskData.notes !== undefined) sheet.getRange(row, 11).setValue(taskData.notes);
        return { success: true };
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function deleteTaskData(id) {
  const cfg = CONFIG.CONTENT_PLANNER;
  const sheet = SpreadsheetApp.openById(cfg.ID).getSheetByName(cfg.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  for (let row = cfg.DATA_START_ROW; row <= lastRow; row++) {
    if (sheet.getRange(row, 1).getValue() == id) {
      sheet.getRange(row, 1, 1, 11).clearContent();
      return { success: true };
    }
  }
}

function formatDate(date) {
  if (!date || isNaN(Date.parse(date)) && !(date instanceof Date)) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ========================================
// AUTO TASK CREATION FOR PRESTASI MAHASISWA
// ========================================

function autoCreatePrestasiTask() {
  try {
    // Use existing CONFIG
    const prestasiSheet = SpreadsheetApp.openById(CONFIG.PRESTASI.ID).getSheetByName(CONFIG.PRESTASI.SHEET_NAME);
    const taskSheet = SpreadsheetApp.openById(CONFIG.CONTENT_PLANNER.ID).getSheetByName(CONFIG.CONTENT_PLANNER.SHEET_NAME);
    
    if (!prestasiSheet || !taskSheet) {
      Logger.log('ERROR: Required sheets not found');
      Logger.log('Prestasi Sheet: ' + (prestasiSheet ? 'Found' : 'NOT FOUND'));
      Logger.log('Task Sheet: ' + (taskSheet ? 'Found' : 'NOT FOUND'));
      return;
    }
    
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();
    
    // Determine batch based on date
    const batch = day === 15 ? 1 : 2;
    const startDate = batch === 1 ? 1 : 16;
    const endDate = batch === 1 ? 15 : new Date(year, month + 1, 0).getDate();
    
    Logger.log(`Checking Batch ${batch}: ${startDate}-${endDate} ${month+1}/${year}`);
    
    // Get prestasi data (skip header row)
    const lastRow = prestasiSheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('No prestasi data found');
      return;
    }
    
    const prestasiData = prestasiSheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const newPrestasi = [];
    
    // Filter prestasi in date range
    for (let i = 0; i < prestasiData.length; i++) {
      const row = prestasiData[i];
      const timestamp = new Date(row[CONFIG.PRESTASI.COLUMNS.TIMESTAMP]);
      
      // Check if timestamp is in current batch range
      if (timestamp.getMonth() === month && 
          timestamp.getFullYear() === year &&
          timestamp.getDate() >= startDate &&
          timestamp.getDate() <= endDate) {
        
        newPrestasi.push({
          nama: row[CONFIG.PRESTASI.COLUMNS.NAMA],
          npm: row[CONFIG.PRESTASI.COLUMNS.NPM],
          kegiatan: row[CONFIG.PRESTASI.COLUMNS.KEGIATAN],
          tingkat: row[CONFIG.PRESTASI.COLUMNS.TINGKAT],
          timestamp: timestamp
        });
      }
    }
    
    Logger.log(`Found ${newPrestasi.length} new prestasi for Batch ${batch}`);
    
    // Skip if no new prestasi
    if (newPrestasi.length === 0) {
      Logger.log('No new prestasi, skipping task creation');
      return;
    }
    
    // Create task name
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const taskName = `Prestasi Mahasiswa ${monthNames[month]} Batch ${batch}`;
    
    // Check if task already exists (prevent duplicates)
    const taskLastRow = taskSheet.getLastRow();
    if (taskLastRow >= CONFIG.CONTENT_PLANNER.DATA_START_ROW) {
      const taskData = taskSheet.getRange(CONFIG.CONTENT_PLANNER.DATA_START_ROW, 2, taskLastRow - CONFIG.CONTENT_PLANNER.DATA_START_ROW + 1, 1).getValues();
      for (let i = 0; i < taskData.length; i++) {
        if (taskData[i][0] === taskName) {
          Logger.log('Task already exists, skipping');
          return;
        }
      }
    }
    
    // Format notes with student list
    let notes = 'Daftar Penerima Prestasi:\n\n';
    newPrestasi.forEach((p, index) => {
      notes += `${index + 1}. ${p.nama} (${p.npm})\n`;
      notes += `   ${p.kegiatan} - ${p.tingkat}\n\n`;
    });
    
    // Calculate due date (+7 days from today)
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);
    
    // Get next task number
    let lastNumber = 0;
    let lastNumberRow = CONFIG.CONTENT_PLANNER.DATA_START_ROW - 1;
    
    if (taskLastRow >= CONFIG.CONTENT_PLANNER.DATA_START_ROW) {
      for (let row = taskLastRow; row >= CONFIG.CONTENT_PLANNER.DATA_START_ROW; row--) {
        const val = taskSheet.getRange(row, 1).getValue();
        if (!isNaN(val) && val > 0) {
          lastNumber = val;
          lastNumberRow = row;
          break;
        }
      }
    }
    
    const writeRow = lastNumberRow + 1;
    const newNo = lastNumber + 1;
    
    // Create new task row
    taskSheet.getRange(writeRow, 1, 1, 11).setValues([[
      newNo,                // No
      taskName,             // Task
      'Instagram',          // Platform
      'Feeds',              // Format
      'Design Creator',     // Assigned To
      dueDate,              // Due Date
      '',                   // Date Left (formula will be set)
      'Not Done',           // In Progress
      '',                   // Reference
      '',                   // Result
      notes                 // Notes
    ]]);
    
    // Set date format and formula
    taskSheet.getRange(writeRow, 6).setNumberFormat('yyyy-mm-dd');
    taskSheet.getRange(writeRow, 7).setFormula(`=F${writeRow}-TODAY()`);
    
    Logger.log(`✅ Successfully created task: ${taskName}`);
    Logger.log(`   Due Date: ${formatDate(dueDate)}`);
    Logger.log(`   Students: ${newPrestasi.length}`);
    
  } catch (error) {
    Logger.log(`❌ ERROR: ${error.message}`);
    Logger.log(error.stack);
  }
}

// SETUP TRIGGERS
function setupMonthlyTriggers() {
  try {
    // Delete existing triggers to avoid duplicates
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'autoCreatePrestasiTask') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create trigger for 15th at 9 PM (21:00)
    ScriptApp.newTrigger('autoCreatePrestasiTask')
      .timeBased()
      .onMonthDay(15)
      .atHour(21)
      .create();
    
    Logger.log('✅ Trigger created for 15th at 9 PM');
    
    // Create trigger for 30th at 9 PM (21:00)
    ScriptApp.newTrigger('autoCreatePrestasiTask')
      .timeBased()
      .onMonthDay(30)
      .atHour(21)
      .create();
    
    Logger.log('✅ Trigger created for 30th at 9 PM');
    Logger.log('✅ All triggers setup complete!');
    
  } catch (error) {
    Logger.log(`❌ ERROR setting up triggers: ${error.message}`);
  }
}

// MANUAL TEST FUNCTION
function testAutoTaskCreation() {
  Logger.log('=== TESTING AUTO TASK CREATION ===');
  autoCreatePrestasiTask();
  Logger.log('=== TEST COMPLETE ===');
}
