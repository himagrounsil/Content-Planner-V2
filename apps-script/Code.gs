/**
 * HIMAGRO Content Management System - Backend v3.0
 * Fitur: Fleksibilitas Tinggi (Header Mapping), Dropdown Dinamis, & Log History.
 * Catatan: Menggunakan pencarian nama kolom agar tahan lama (turun temurun).
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
  CONTENT_PLANNER: {
    ID: '1HfFmOx8iGWvA_XEWvz8RSBMxxbOZKCA459fOkD1JT_E', // ID Spreadsheet Content Planner
    SHEET_NAME: 'Content Planner',
    DATA_START_ROW: 17,
    COLUMNS: { NO: 0, TASK: 1, PLATFORM: 2, FORMAT: 3, ASSIGNED_TO: 4, DUE_DATE: 5, DATE_LEFT: 6, IN_PROGRESS: 7, REFERENCE: 8, RESULT: 9, NOTES: 10 }
  },
  PRESTASI: {
    ID: '1tbfeEDE4EY7OuE0MRKNYQ7SreRpeMa_GbckdVui1frE', // ID Spreadsheet Prestasi
    SHEET_NAME: 'Form Responses 1'
  },
  MEDIA_PARTNER: {
    ID: '1e_FaJw2Csq67PmifCf0ajfWXZHhkSEPO8u0LnquZlqc', // ID Spreadsheet Media Partner
    SHEET_NAME: 'Form Responses 1'
  }
};

// ==================== WEB APP ENTRY POINT ====================
function doGet(e) {
  try {
    const action = e.parameter.action || 'getTasks';
    const callback = e.parameter.callback;

    let result;
    switch (action) {
      case 'getAllData': result = getAllCombinedData(); break;
      case 'getTasks': result = getTasksData(); break;
      case 'getPrestasi': result = getPrestasiData(); break;
      case 'getMediaPartner': result = getMediaPartnerData(); break;
      case 'getDropdowns': result = getDropdownData(); break;
      case 'createTask': result = createTaskData(JSON.parse(e.parameter.data || '{}')); break;
      case 'updateTask': result = updateTaskData(parseInt(e.parameter.id, 10), JSON.parse(e.parameter.data || '{}')); break;
      case 'deleteTask': result = deleteTaskData(parseInt(e.parameter.id, 10)); break;
      case 'logActivity': result = logActivity(JSON.parse(e.parameter.data || '{}')); break;
      case 'processMedia': result = processMediaPartnerRow(JSON.parse(e.parameter.data || '{}')); break;
      default: result = { error: 'Invalid action' };
    }
    return buildResponse(result, callback);
  } catch (error) {
    return buildResponse({ error: error.message }, e && e.parameter && e.parameter.callback);
  }
}

function getAllCombinedData() {
  try {
    // Optimization: Open spreadsheets once and reuse
    const ssPlanner = SpreadsheetApp.openById(CONFIG.CONTENT_PLANNER.ID);
    const ssPrestasi = SpreadsheetApp.openById(CONFIG.PRESTASI.ID);
    const ssMedia = SpreadsheetApp.openById(CONFIG.MEDIA_PARTNER.ID);

    const tasks = getTasksData(ssPlanner);
    const dropdowns = getDropdownData(ssPlanner);
    
    // Pass existing task list to media partner to avoid re-opening planner
    const existingTaskNames = tasks.map(t => `Media Partner (${t.task})`.toLowerCase());
    const media = getMediaPartnerData(ssMedia, existingTaskNames);
    
    const prestasi = getPrestasiData(ssPrestasi);

    return { tasks, prestasi, media, dropdowns };
  } catch (e) {
    return { error: 'Optimizer Error: ' + e.message };
  }
}

function buildResponse(data, callback) {
  const payload = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + payload + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

// ==================== DROPDOWN & LOGGING FUNCTIONS ====================

function getDropdownData(openedSs) {
  try {
    const ss = openedSs || SpreadsheetApp.openById(CONFIG.CONTENT_PLANNER.ID);
    const sheet = ss.getSheetByName('Dropdown List');
    if (!sheet) return { assignedTo: [], format: [] };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const subDivCol = headers.indexOf('UniqueSubDiv');
    const formatCol = headers.indexOf('UniqueFormat');

    const assignedTo = [];
    const format = [];

    for (let i = 1; i < data.length; i++) {
        if (subDivCol > -1 && data[i][subDivCol]) assignedTo.push(data[i][subDivCol]);
        if (formatCol > -1 && data[i][formatCol]) format.push(data[i][formatCol]);
    }

    return { 
        assignedTo: [...new Set(assignedTo)], 
        format: [...new Set(format)] 
    };
  } catch (e) {
    return { error: e.message };
  }
}

function logActivity(logData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.CONTENT_PLANNER.ID);
    let sheet = ss.getSheetByName('Log History');
    if (!sheet) {
      sheet = ss.insertSheet('Log History');
      sheet.appendRow(['Timestamp', 'User', 'Action', 'Target ID', 'Details']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f3f3f3');
    }
    sheet.appendRow([
      new Date(),
      logData.user || 'System',
      logData.action || '-',
      logData.targetId || '-',
      logData.details || '-'
    ]);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

// ==================== CONTENT PLANNER FUNCTIONS ====================

function getTasksData(openedSs) {
  const cfg = CONFIG.CONTENT_PLANNER;
  const ss = openedSs || SpreadsheetApp.openById(cfg.ID);
  const sheet = ss.getSheetByName(cfg.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < cfg.DATA_START_ROW) return [];
  
  const values = sheet.getRange(cfg.DATA_START_ROW, 1, lastRow - cfg.DATA_START_ROW + 1, 11).getValues();
  
  // FILTER: Hanya ambil baris yang kolom TASK-nya tidak kosong
  return values
    .filter(row => row[cfg.COLUMNS.TASK] && row[cfg.COLUMNS.TASK].toString().trim() !== "")
    .map((row, index) => ({
      no: row[cfg.COLUMNS.NO] || "",
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
    // Cari baris berdasarkan ID di kolom pertama (No)
    if (sheet.getRange(row, 1).getValue() == id) {
      sheet.deleteRow(row); // Hapus baris secara fisik
      return { success: true };
    }
  }
}

// ==================== PRESTASI FUNCTIONS (HEADER MAPPING) ====================

function getPrestasiData(openedSs) {
  try {
    const cfg = CONFIG.PRESTASI;
    const ss = openedSs || SpreadsheetApp.openById(cfg.ID);
    const sheet = ss.getSheetByName(cfg.SHEET_NAME);
    if (!sheet) return [];
    
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    
    const map = {
      timestamp: findColumn(headers, ["Timestamp"]),
      email: findColumn(headers, ["Email"]),
      nama: findColumn(headers, ["Nama"]),
      npm: findColumn(headers, ["NPM", "Nomor Pokok"]),
      kegiatan: findColumn(headers, ["Kegiatan", "Kompetisi"]),
      penyelenggara: findColumn(headers, ["Penyelenggara"]),
      tingkat: findColumn(headers, ["Tingkat"]),
      capaian: findColumn(headers, ["Capaian", "Prestasi", "Juara"]),
      bukti: findColumn(headers, ["Bukti", "Sertifikat", "Upload"]),
      dosen: findColumn(headers, ["Dosen", "Pembimbing"]),
      surat: findColumn(headers, ["Surat", "Validasi"])
    };
    
    return allData.slice(1).map(row => ({
      timestamp: map.timestamp > -1 ? formatDate(row[map.timestamp]) : "",
      email: map.email > -1 ? row[map.email] : "",
      nama: map.nama > -1 ? row[map.nama] : "Anonymous",
      npm: map.npm > -1 ? row[map.npm] : "-",
      kegiatan: map.kegiatan > -1 ? row[map.kegiatan] : "-",
      penyelenggara: map.penyelenggara > -1 ? row[map.penyelenggara] : "-",
      tingkat: map.tingkat > -1 ? row[map.tingkat] : "Regional",
      capaian: map.capaian > -1 ? row[map.capaian] : "-",
      bukti: map.bukti > -1 ? row[map.bukti] : "",
      dosen: map.dosen > -1 ? row[map.dosen] : "-",
      surat: map.surat > -1 ? row[map.surat] : ""
    }));
  } catch (e) { return { error: e.message }; }
}

// ==================== MEDIA PARTNER FUNCTIONS (HEADER MAPPING) ====================

function getMediaPartnerData(openedSs, existingTasks) {
  try {
    const cfg = CONFIG.MEDIA_PARTNER;
    const ss = openedSs || SpreadsheetApp.openById(cfg.ID);
    const sheet = ss.getSheetByName(cfg.SHEET_NAME);
    if (!sheet) return [];

    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];

    // Check mapping
    const map = {
      timestamp: findColumn(headers, ["Timestamp"]),
      nama: findColumn(headers, ["Nama", "CP"]),
      wa: findColumn(headers, ["WA", "WhatsApp"]),
      instansi: findColumn(headers, ["Instansi", "Organisasi"]),
      kegiatan: findColumn(headers, ["Kegiatan", "Acara"]),
      proposal: findColumn(headers, ["Proposal"]),
      surat: findColumn(headers, ["Surat"]),
      publikasi: findColumn(headers, ["Publikasi", "Tanggal", "Tayang"]),
      email: findColumn(headers, ["Email"]),
      drive: findColumn(headers, ["Drive", "Aset", "Link"]),
      status: headers.indexOf("CMS_Status")
    };
    
    // Use pre-fetched list or fetch now
    let plannerTasks = existingTasks;
    if (!plannerTasks) {
       const taskSheet = SpreadsheetApp.openById(CONFIG.CONTENT_PLANNER.ID).getSheetByName(CONFIG.CONTENT_PLANNER.SHEET_NAME);
       const lastRow = taskSheet.getLastRow();
       plannerTasks = lastRow >= CONFIG.CONTENT_PLANNER.DATA_START_ROW ? 
         taskSheet.getRange(CONFIG.CONTENT_PLANNER.DATA_START_ROW, 2, lastRow - CONFIG.CONTENT_PLANNER.DATA_START_ROW + 1, 1).getValues().flat().map(t => t.toString().toLowerCase()) : [];
    }

    return allData.slice(1).map((row, idx) => {
      const kegiatanVal = map.kegiatan > -1 ? row[map.kegiatan] : "-";
      const taskName = `Media Partner (${kegiatanVal})`.toLowerCase();
      
      const isManualProcessed = map.status > -1 && row[map.status] === "PROCESSED";
      const isExistsInPlanner = plannerTasks.includes(taskName);
      const isTaskCreated = isManualProcessed || isExistsInPlanner;

      return {
        rowIdx: idx + 2,
        timestamp: map.timestamp > -1 ? formatDate(row[map.timestamp]) : "",
        nama: map.nama > -1 ? row[map.nama] : "-",
        wa: map.wa > -1 ? row[map.wa] : "-",
        instansi: map.instansi > -1 ? row[map.instansi] : "-",
        kegiatan: kegiatanVal,
        proposal: map.proposal > -1 ? row[map.proposal] : "",
        surat: map.surat > -1 ? row[map.surat] : "",
        publikasi: map.publikasi > -1 ? formatDate(row[map.publikasi]) : "",
        email: map.email > -1 ? row[map.email] : "",
        drive: map.drive > -1 ? row[map.drive] : "",
        taskCreated: isTaskCreated ? 'TRUE' : 'FALSE'
      };
    });
  } catch (e) { return { error: e.message }; }
}

// ==================== AUTO TASK CREATION (FLEKSIBEL) ====================

function autoCreatePrestasiTask() {
  try {
    const ssPrestasi = SpreadsheetApp.openById(CONFIG.PRESTASI.ID);
    const prestasiSheet = ssPrestasi.getSheetByName(CONFIG.PRESTASI.SHEET_NAME);
    const allData = prestasiSheet.getDataRange().getValues();
    const headers = allData[0];
    
    // Cari atau tentukan kolom CMS_Status
    let statusCol = headers.indexOf("CMS_Status");
    if (statusCol === -1) {
      statusCol = headers.length;
      prestasiSheet.getRange(1, statusCol + 1).setValue("CMS_Status");
    }

    const map = {
      nama: findColumn(headers, ["Nama"]),
      npm: findColumn(headers, ["NPM", "Nomor Pokok"]),
      kegiatan: findColumn(headers, ["Kegiatan", "Kompetisi"]),
      tingkat: findColumn(headers, ["Tingkat"])
    };
    
    const newPrestasi = [];
    const rowsToMark = [];

    for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        if (!row[statusCol]) {
            newPrestasi.push({
                nama: map.nama > -1 ? row[map.nama] : "Anonymous",
                npm: map.npm > -1 ? row[map.npm] : "-",
                kegiatan: map.kegiatan > -1 ? row[map.kegiatan] : "-",
                tingkat: map.tingkat > -1 ? row[map.tingkat] : "Regional"
            });
            rowsToMark.push(i + 1);
        }
    }
    
    if (newPrestasi.length === 0) return;
    
    const today = new Date();
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const displayMonth = today.getDate() < 5 ? (today.getMonth() === 0 ? 11 : today.getMonth() - 1) : today.getMonth();
    const batch = today.getDate() > 10 && today.getDate() < 20 ? 1 : 2;
    
    const taskName = `Prestasi Mahasiswa ${monthNames[displayMonth]} Batch ${batch}`;
    let notes = 'Daftar Penerima Prestasi:\n\n';
    newPrestasi.forEach((p, index) => {
      notes += `${index + 1}. ${p.nama} (${p.npm}) - ${p.kegiatan}\n`;
    });
    
    const result = createTaskData({
      task: taskName,
      platform: 'Instagram',
      format: 'Feeds',
      assignedTo: 'Design Creator',
      dueDate: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
      inProgress: 'Not Done',
      notes: notes
    });

    if (result.success) {
        rowsToMark.forEach(rowNum => {
            prestasiSheet.getRange(rowNum, statusCol + 1).setValue("PROCESSED");
        });
    }
  } catch (e) { Logger.log("Error Prestasi Auto: " + e.message); }
}

function autoCreateMediaPartnerTask() {
  try {
    const mpSheet = SpreadsheetApp.openById(CONFIG.MEDIA_PARTNER.ID).getSheetByName(CONFIG.MEDIA_PARTNER.SHEET_NAME);
    const allData = mpSheet.getDataRange().getValues();
    const headers = allData[0];
    
    let statusCol = headers.indexOf("CMS_Status");
    if (statusCol === -1) {
      statusCol = headers.length;
      mpSheet.getRange(1, statusCol + 1).setValue("CMS_Status");
    }

    const map = {
      kegiatan: findColumn(headers, ["Kegiatan", "Acara"]),
      publikasi: findColumn(headers, ["Publikasi", "Tanggal", "Tayang"]),
      instansi: findColumn(headers, ["Instansi", "Organisasi"]),
      drive: findColumn(headers, ["Drive", "Aset", "Link"])
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const h7Threshold = new Date(today);
    h7Threshold.setDate(today.getDate() + 7);

    allData.slice(1).forEach((row, idx) => {
      if (row[statusCol] === "PROCESSED") return;

      const kegiatan = map.kegiatan > -1 ? row[map.kegiatan] : "";
      const pubVal = map.publikasi > -1 ? row[map.publikasi] : null;
      if (!kegiatan || !pubVal) return;
      
      const publikasiDate = new Date(pubVal);
      if (publikasiDate <= h7Threshold) {
        const result = createTaskData({
          task: `Media Partner (${kegiatan})`,
          platform: 'Instagram',
          format: 'Feeds',
          assignedTo: 'Design Creator',
          dueDate: formatDate(publikasiDate),
          inProgress: 'Not Done',
          notes: `Instansi: ${map.instansi > -1 ? row[map.instansi] : "-"}\nDrive: ${map.drive > -1 ? row[map.drive] : "-"}`
        });

        if (result.success) {
           mpSheet.getRange(idx + 2, statusCol + 1).setValue("PROCESSED");
        }
      }
    });
  } catch (e) { Logger.log(e.message); }
}

function processMediaPartnerRow(data) {
  try {
    const mpSheet = SpreadsheetApp.openById(CONFIG.MEDIA_PARTNER.ID).getSheetByName(CONFIG.MEDIA_PARTNER.SHEET_NAME);
    const headers = mpSheet.getRange(1, 1, 1, mpSheet.getLastColumn()).getValues()[0];
    
    let statusCol = headers.indexOf("CMS_Status");
    if (statusCol === -1) {
      statusCol = headers.length;
      mpSheet.getRange(1, statusCol + 1).setValue("CMS_Status");
    }

    const createResult = createTaskData(data.taskData);
    if (createResult.success) {
      mpSheet.getRange(data.rowIdx, statusCol + 1).setValue("PROCESSED");
      return { success: true };
    }
    return { success: false, error: "Failed to create task" };
  } catch (e) { return { error: e.message }; }
}

function setupMonthlyTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    ScriptApp.newTrigger('autoCreatePrestasiTask').timeBased().onMonthDay(15).atHour(21).create();
    ScriptApp.newTrigger('autoCreatePrestasiTask').timeBased().onMonthDay(1).atHour(1).create();
    ScriptApp.newTrigger('autoCreateMediaPartnerTask').timeBased().everyDays(1).atHour(1).create();
  } catch (e) { Logger.log(e.message); }
}

// ==================== UTILITIES ====================

function formatDate(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch(e) { return ''; }
}

function findColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().toLowerCase();
    for (const kw of keywords) {
      if (header.includes(kw.toLowerCase())) return i;
    }
  }
  return -1;
}

