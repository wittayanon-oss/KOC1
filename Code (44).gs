// ============================================================



// ระบบเช็คชื่อหน้าเสาธงระดับชั้น ม.2



// ฐานข้อมูล Google Sheets: 1A3IFOckb38ufeJBTkqGewiLr5vRKCBJwFF7wDf7JOnk



// ข้อมูลนักเรียนอ่านจาก InfoStudent; Data เก็บข้อมูล 6 คอลัมน์ หนึ่งแถวต่อนักเรียนต่อวัน

// สิทธิ์ Admin อ่านจากคอลัมน์ [สถานะ] ในชีต InfoTeacher



// ============================================================



const SPREADSHEET_ID = '1A3IFOckb38ufeJBTkqGewiLr5vRKCBJwFF7wDf7JOnk';



const APP_TIME_ZONE = 'Asia/Bangkok';



const ADMIN_STATUS_VALUE = 'Admin';



// ตั้งค่าเริ่มต้นของระบบ ทุกตัวสามารถเปิด/ปิดได้จากหน้าแอดมิน

const SYSTEM_DEFAULT_SETTINGS = {

  studentLogin: true,

  teacherLogin: true,

  studentSelfCheck: true,

  teacherAttendance: true,

  lateReport: true,

  absentLeaveReport: true,

  roomReport: true,

  customParentReport: true,

  emailNotifications: true,

  dailyExceptionEmailReport: true

};



const SYSTEM_SETTING_LABELS = {

  studentLogin: 'เปิด/ปิดการเข้าสู่ระบบของนักเรียน',

  teacherLogin: 'เปิด/ปิดการเข้าสู่ระบบของครู (แอดมินยังเข้าสู่ระบบได้)',

  studentSelfCheck: 'เปิด/ปิดการบันทึกเช็คชื่อด้วยตนเองของนักเรียน',

  teacherAttendance: 'เปิด/ปิดการเช็คชื่อและบันทึกข้อมูลโดยครู',

  lateReport: 'เปิด/ปิดรายงานนักเรียนขอมาสายระดับชั้น ม.2',

  absentLeaveReport: 'เปิด/ปิดรายงานนักเรียนขาด/ลาระดับชั้น ม.2',

  roomReport: 'เปิด/ปิดรายงานสรุปการเช็คชื่อรายห้อง',

  customParentReport: 'เปิด/ปิดรายงานย้อนหลังตามช่วงเวลา/รายบุคคล',

  emailNotifications: 'เปิด/ปิดการส่งสรุปข้อมูลทาง E-mail ถึงครูและนักเรียน',

  dailyExceptionEmailReport: 'เปิด/ปิดปุ่มส่งรายงานคนลา ขาดเรียน และกิจกรรมไปยัง E-mail Admin'

};











function doGet(e) {



  return HtmlService.createHtmlOutput(getHtmlContent())



      .setTitle('ระบบเช็คชื่อหน้าเสาธง ม.2')



      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)



      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');



}











function getSpreadsheet_() {



  return SpreadsheetApp.openById(SPREADSHEET_ID);



}











function getSheetByName(name) {



  const sheet = getSpreadsheet_().getSheetByName(name);



  if (!sheet) throw new Error('ไม่พบชีตชื่อ ' + name + ' ในฐานข้อมูล');



  return sheet;



}











// แปลงชื่อหัวคอลัมน์ให้ค้นหาได้แม้มีช่องว่าง/วงเล็บ/ขีด



function normalizeHeader_(value) {



  return String(value == null ? '' : value)



    .trim()



    .replace(/[\[\]\s_-]/g, '')



    .toLowerCase();



}











function findHeaderIndex_(headers, candidates) {



  const normalized = headers.map(normalizeHeader_);



  for (let i = 0; i < candidates.length; i++) {



    const target = normalizeHeader_(candidates[i]);



    const exact = normalized.indexOf(target);



    if (exact !== -1) return exact;



  }



  return -1;



}











function getTeacherColumnMap_(headers) {

  const idIndex = findHeaderIndex_(headers, ['รหัสครู', 'รหัสคุณครู', 'teacherid', 'teacher code', 'id']);

  const nameIndex = findHeaderIndex_(headers, ['ชื่อครู', 'ชื่อคุณครู', 'ชื่อ-นามสกุล', 'ชื่อสกุล', 'ชื่อ']);

  const roomIndex = findHeaderIndex_(headers, ['ห้องที่ปรึกษา', 'รหัสห้องเรียน', 'ห้องเรียน', 'ห้อง', 'room']);

  const statusIndex = findHeaderIndex_(headers, ['สถานะ', 'status']);

  // หากมีคอลัมน์ [รหัสผ่าน] ให้ใช้เป็นรหัสเข้าสู่ระบบ
  // หากไม่มี จะใช้คอลัมน์ [รหัสครู] เดิมเพื่อไม่ให้ระบบเก่าได้รับผลกระทบ
  const passwordIndex = findHeaderIndex_(headers, ['รหัสผ่านครู', 'รหัสผ่าน', 'รหัสเข้าสู่ระบบ', 'password', 'login password']);

  let emailIndex = findHeaderIndex_(headers, ['E-mail ครู', 'Email ครู', 'อีเมลครู', 'อีเมล', 'email address', 'email', 'e-mail', 'mail']);

  if (emailIndex === -1) {

    emailIndex = headers.findIndex(h => {

      const n = normalizeHeader_(h);

      return n.includes('email') || n.includes('mail') || n.includes('อีเมล');

    });

  }

  const resolvedIdIndex = idIndex === -1 ? 0 : idIndex;

  return {

    id: resolvedIdIndex,

    password: passwordIndex === -1 ? resolvedIdIndex : passwordIndex,

    name: nameIndex === -1 ? 1 : nameIndex,

    room: roomIndex === -1 ? 2 : roomIndex,

    status: statusIndex,

    email: emailIndex

  };

}





function isValidEmail_(value) {

  const email = String(value == null ? '' : value).trim();

  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);

}





function findEmailInRow_(row, emailIndex) {

  if (emailIndex >= 0 && isValidEmail_(row[emailIndex])) return String(row[emailIndex]).trim();

  return '';

}





function getTeacherRecordById_(teacherId) {

  const sheet = getSheetByName('InfoTeacher');

  const values = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) return null;

  const map = getTeacherColumnMap_(values[0]);

  if (map.status < 0) throw new Error('ไม่พบคอลัมน์ [สถานะ] ในชีต InfoTeacher');

  const wantedId = String(teacherId == null ? '' : teacherId).trim();

  for (let r = 1; r < values.length; r++) {

    const row = values[r];

    const rowId = String(row[map.id] == null ? '' : row[map.id]).trim();

    if (rowId !== wantedId) continue;

    const status = String(row[map.status] || '').trim();

    return {

      id: rowId,

      name: String(row[map.name] || 'คุณครู').trim(),

      room: String(row[map.room] || '').trim(),

      status: status,

      email: findEmailInRow_(row, map.email),


      isAdmin: status.toLowerCase() === ADMIN_STATUS_VALUE.toLowerCase()

    };

  }

  return null;

}


/** ค้นหาบัญชีครูด้วยรหัสผ่านที่ใช้เข้าสู่ระบบ
 * รองรับทั้งคอลัมน์ [รหัสผ่าน] และรูปแบบเดิมที่ใช้ [รหัสครู] เป็นรหัสผ่าน
 */
function getTeacherRecordByLoginPassword_(loginPassword) {
  const wantedPassword = String(loginPassword == null ? '' : loginPassword).trim();
  if (!wantedPassword) return null;

  const sheet = getSheetByName('InfoTeacher');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const map = getTeacherColumnMap_(values[0]);
  if (map.status < 0) throw new Error('ไม่พบคอลัมน์ [สถานะ] ในชีต InfoTeacher');

  let matched = null;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const storedPassword = String(row[map.password] == null ? '' : row[map.password]).trim();
    const fallbackId = String(row[map.id] == null ? '' : row[map.id]).trim();
    const effectivePassword = storedPassword || fallbackId;
    if (effectivePassword !== wantedPassword) continue;

    if (matched) {
      throw new Error('พบรหัสผ่านซ้ำในชีต InfoTeacher กรุณาให้ผู้ดูแลระบบตรวจสอบข้อมูลก่อนเข้าสู่ระบบ');
    }

    const status = String(row[map.status] || '').trim();
    matched = {
      id: fallbackId,
      name: String(row[map.name] || 'คุณครู').trim(),
      room: String(row[map.room] || '').trim(),
      status: status,
      email: findEmailInRow_(row, map.email),
      isAdmin: status.toLowerCase() === ADMIN_STATUS_VALUE.toLowerCase()
    };
  }
  return matched;
}


function getAdminEmailRecipients_() {

  const values = getSheetByName('InfoTeacher').getDataRange().getDisplayValues();

  if (values.length < 2) return { recipients: [], missingEmailNames: [] };

  const map = getTeacherColumnMap_(values[0]);

  if (map.status < 0) throw new Error('ไม่พบคอลัมน์ [สถานะ] ในชีต InfoTeacher');

  const recipients = [];

  const missingEmailNames = [];

  const seen = {};

  for (let r = 1; r < values.length; r++) {

    const row = values[r];

    if (String(row[map.status] || '').trim().toLowerCase() !== ADMIN_STATUS_VALUE.toLowerCase()) continue;

    const email = findEmailInRow_(row, map.email);

    const name = String(row[map.name] || row[map.id] || 'Admin').trim();

    if (!email) {

      missingEmailNames.push(name);

      continue;

    }

    if (!seen[email.toLowerCase()]) {

      seen[email.toLowerCase()] = true;

      recipients.push({ email: email, name: name });

    }

  }

  return { recipients: recipients, missingEmailNames: missingEmailNames };

}





// อ่านคอลัมน์ของชีต InfoStudent โดยยึดหัวคอลัมน์จริงเป็นหลัก

function getStudentColumnMap_(headers) {

  let idIndex = findHeaderIndex_(headers, ['เลขประจำตัวนักเรียน', 'รหัสประจำตัวนักเรียน', 'รหัสนักเรียน', 'เลขประจำตัว', 'studentid', 'student id', 'id']);

  let nameIndex = findHeaderIndex_(headers, ['ชื่อนักเรียน', 'ชื่อ-นามสกุล', 'ชื่อสกุล', 'ชื่อ']);

  let roomIndex = findHeaderIndex_(headers, ['ห้องที่ปรึกษา', 'ห้องเรียน', 'ห้อง', 'ระดับชั้น/ห้อง', 'ชั้น/ห้อง', 'room']);

  let gradeIndex = findHeaderIndex_(headers, ['มัธยมศึกษาปีที่', 'ระดับชั้น', 'ชั้นปี', 'ชั้น', 'grade', 'ระดับ']);

  let emailIndex = findHeaderIndex_(headers, ['E-mail นักเรียน', 'Email นักเรียน', 'อีเมลนักเรียน', 'อีเมล', 'email address', 'email', 'e-mail', 'mail']);

  if (emailIndex === -1) {

    emailIndex = headers.findIndex(h => {

      const n = normalizeHeader_(h);

      return n.includes('email') || n.includes('mail') || n.includes('อีเมล');

    });

  }

  return {

    no: findHeaderIndex_(headers, ['ที่', 'เลขที่', 'ลำดับ', 'no']),

    id: idIndex === -1 ? 1 : idIndex,

    name: nameIndex === -1 ? 2 : nameIndex,

    room: roomIndex === -1 ? 3 : roomIndex,

    grade: gradeIndex,

    email: emailIndex

  };

}



function isM2GradeValue_(value) {

  const text = String(value == null ? '' : value).trim().toLowerCase().replace(/\s+/g, '');

  if (!text) return true; // หากไม่มีการกรอกระดับชั้น ให้ถือว่าอยู่ในชุดข้อมูลของชีตนี้

  return /ม\.?2|มัธยมศึกษาปีที่2|มัธยม2|^2(?:\/|$)/.test(text);

}



function getStudentRoster_() {

  const values = getSheetByName('InfoStudent').getDataRange().getDisplayValues();

  if (values.length < 2) return [];

  const map = getStudentColumnMap_(values[0]);

  const roster = [];

  const seen = {};

  for (let r = 1; r < values.length; r++) {

    const row = values[r];

    const id = String(row[map.id] == null ? '' : row[map.id]).trim();

    if (!id || seen[id]) continue;

    const grade = map.grade >= 0 ? String(row[map.grade] || '').trim() : '';

    if (map.grade >= 0 && !isM2GradeValue_(grade)) continue;

    seen[id] = true;

    roster.push({

      no: map.no >= 0 ? String(row[map.no] || '') : '',

      id: id,

      name: String(row[map.name] || 'นักเรียน').trim(),

      room: String(row[map.room] || '').trim(),

      grade: grade,

      email: findEmailInRow_(row, map.email)

    });

  }

  return roster;

}



function getStudentRecordById_(studentId) {

  const wantedId = String(studentId == null ? '' : studentId).trim();

  if (!wantedId) return null;

  const roster = getStudentRoster_();

  for (let i = 0; i < roster.length; i++) {

    if (roster[i].id === wantedId) return roster[i];

  }

  return null;

}



// Data ใช้เก็บประวัติการเช็คชื่อ โดยเชื่อมกับ InfoStudent ด้วยเลขประจำตัวเท่านั้น

// คอลัมน์ A:D แบบเดิมยังคงอยู่ได้เพื่อรองรับข้อมูลย้อนหลัง แต่ไม่ใช้ชื่อ/ห้องจาก Data เป็นแหล่งข้อมูลหลัก

function getAttendanceSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Data');

  if (!sheet) {
    const legacySheet = ss.getSheetByName('DATA');
    if (legacySheet) {
      sheet = legacySheet;
      try { sheet.setName('Data'); } catch (err) { /* ใช้ชื่อเดิมได้ หาก Google Sheets ไม่อนุญาตให้เปลี่ยน */ }
    }
  }

  if (!sheet) sheet = ss.insertSheet('Data');
  ensureAttendanceSheetSchema_(sheet);
  return sheet;
}


function getAttendanceHeaders_() {
  return ['เลขที่', 'เลขประจำตัวนักเรียน', 'ชื่อนักเรียน', 'ห้อง', 'วันที่', 'สถานะ'];
}


function ensureAttendanceSheetSchema_(sheet) {
  const expected = getAttendanceHeaders_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    if (sheet.getMaxColumns() < expected.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), expected.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    return;
  }

  const headerWidth = Math.max(expected.length, lastColumn);
  const headerValues = sheet.getRange(1, 1, 1, headerWidth).getDisplayValues()[0];
  const firstSix = headerValues.slice(0, 6).map(normalizeHeader_);
  const wanted = expected.map(normalizeHeader_);
  const isNewSchema = wanted.every((value, index) => firstSix[index] === value);
  if (isNewSchema) {
    sheet.setFrozenRows(1);
    return;
  }

  // แปลงข้อมูลเก่าที่เก็บวันที่เป็นกลุ่มคอลัมน์แนวนอนให้เป็นหนึ่งแถวต่อนักเรียนต่อวัน
  const oldValues = sheet.getDataRange().getValues();
  const oldDisplay = sheet.getDataRange().getDisplayValues();
  const oldHeaders = oldDisplay[0] || [];
  const oldIdIndex = findHeaderIndex_(oldHeaders, [
    'เลขประจำตัวนักเรียน', 'รหัสประจำตัวนักเรียน', 'รหัสนักเรียน', 'เลขประจำตัว', 'studentid', 'student id', 'id'
  ]);
  const idIndex = oldIdIndex >= 0 ? oldIdIndex : 1;
  const dateColumns = [];
  for (let c = 4; c < oldHeaders.length; c++) {
    const parsedDate = parseAttendanceDate_(oldValues[0][c], oldDisplay[0][c]);
    if (parsedDate) dateColumns.push({ index: c, date: parsedDate });
  }

  // ถ้าเป็นชีตเก่าที่มีเฉพาะหัวตาราง/รายชื่อนักเรียนแต่ยังไม่มีวันที่ ให้เริ่มโครงสร้างใหม่ได้
  if (dateColumns.length === 0 && lastRow <= 1) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
    return;
  }

  if (dateColumns.length === 0) {
    throw new Error('ชีต Data มีโครงสร้างไม่ตรงกับที่ระบบรองรับ และไม่พบหัวคอลัมน์วันที่เดิม จึงหยุดเพื่อป้องกันข้อมูลสูญหาย');
  }

  const roster = getStudentRoster_();
  const rosterMap = {};
  roster.forEach(student => { rosterMap[String(student.id)] = student; });
  const migratedMap = {};

  for (let r = 1; r < oldValues.length; r++) {
    const row = oldValues[r] || [];
    const displayRow = oldDisplay[r] || [];
    const studentId = String(displayRow[idIndex] == null ? '' : displayRow[idIndex]).trim();
    if (!studentId) continue;

    const student = rosterMap[studentId] || {
      no: String(displayRow[0] || ''),
      id: studentId,
      name: String(displayRow[2] || 'นักเรียน').trim(),
      room: String(displayRow[3] || '').trim()
    };

    dateColumns.forEach(dateColumn => {
      const statusIndex = dateColumn.index + 2;
      const reasonIndex = dateColumn.index + 3;
      const status = String(displayRow[statusIndex] == null ? '' : displayRow[statusIndex]).trim();
      if (!status || status === '-') return;

      const dateKey = getAttendanceDateKey_(dateColumn.date);
      const key = studentId + '|' + dateKey;
      const oldReason = String(displayRow[reasonIndex] == null ? '' : displayRow[reasonIndex]).trim();
      let note = oldReason;
      if (oldReason.indexOf('[คุณครูบันทึก]') !== -1) {
        note = oldReason;
      } else if (oldReason) {
        note = 'เหตุผล: ' + oldReason;
      }
      migratedMap[key] = {
        values: [student.no || '', studentId, student.name || '', student.room || '', dateColumn.date, status],
        note: note
      };
    });
  }

  const migratedRows = Object.keys(migratedMap).sort().map(key => migratedMap[key].values);
  const migratedNotes = Object.keys(migratedMap).sort().map(key => ['', '', '', '', '', migratedMap[key].note]);

  sheet.getDataRange().clearNote();
  sheet.clearContents();
  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  if (migratedRows.length) {
    sheet.getRange(2, 2, migratedRows.length, 1).setNumberFormat('@');
    sheet.getRange(2, 1, migratedRows.length, expected.length).setValues(migratedRows);
    sheet.getRange(2, 5, migratedRows.length, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(2, 6, migratedNotes.length, 1).setNotes(migratedNotes.map(note => [note[5]]));
  }
  sheet.setFrozenRows(1);
}


function parseAttendanceDate_(value, displayValue) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const raw = String(displayValue || value || '').trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    let year = Number(match[3]);
    if (year > 2500) year -= 543;
    const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1]), 12, 0, 0, 0));
    return isNaN(date.getTime()) ? null : date;
  }

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}


function getTodayDate_() {
  const key = Utilities.formatDate(new Date(), APP_TIME_ZONE, 'yyyy-MM-dd');
  const parts = key.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
}


function getAttendanceDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP_TIME_ZONE, 'yyyy-MM-dd');
  }
  const date = parseAttendanceDate_(value, value);
  if (!date) return '';
  return Utilities.formatDate(date, APP_TIME_ZONE, 'yyyy-MM-dd');
}


function formatAttendanceDateThai_(dateKey) {
  const parts = String(dateKey).split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return String(dateKey || '');
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0));
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIME_ZONE });
}


function getAttendanceIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const index = { byKey: {}, byDate: {}, dateKeys: [] };
  if (lastRow < 2) return index;

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const displayValues = sheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
  const notes = sheet.getRange(2, 6, lastRow - 1, 1).getNotes();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const displayRow = displayValues[i] || [];
    const studentId = String(displayRow[1] == null ? '' : displayRow[1]).trim();
    const dateKey = getAttendanceDateKey_(row[4]);
    if (!studentId || !dateKey) continue;

    const status = String(row[5] == null ? '' : row[5]).trim() || 'ไม่ได้เช็ค';
    const note = String((notes[i] || [])[0] || '');
    const reason = getAttendanceReasonFromNote_(note);
    const record = { rowNumber: i + 2, id: studentId, dateKey: dateKey, status: status, note: note, reason: reason };
    index.byKey[studentId + '|' + dateKey] = record;
    if (!index.byDate[dateKey]) index.byDate[dateKey] = {};
    index.byDate[dateKey][studentId] = record;
  }
  index.dateKeys = Object.keys(index.byDate).sort();
  return index;
}


function getAttendanceReasonFromNote_(note) {
  const text = String(note || '');
  const match = text.match(/เหตุผล\s*:\s*([^\n]+)/);
  if (match) return match[1].trim();
  if (text.indexOf('[คุณครูบันทึก]') !== -1) return 'บันทึกโดยคุณครู';
  return text.trim();
}


function isTeacherLockedAttendance_(note) {
  return String(note || '').indexOf('[คุณครูบันทึก]') !== -1;
}


function buildAttendanceNote_(reason, teacherLocked) {
  const parts = [];
  if (teacherLocked) parts.push('[คุณครูบันทึก]');
  if (String(reason || '').trim()) parts.push('เหตุผล: ' + String(reason).trim());
  return parts.join('\n');
}


function upsertAttendanceRecord_(sheet, student, dateValue, status, reason, teacherLocked, index) {
  const attendanceIndex = index || getAttendanceIndex_(sheet);
  const date = parseAttendanceDate_(dateValue, dateValue) || getTodayDate_();
  const dateKey = getAttendanceDateKey_(date);
  const key = String(student.id).trim() + '|' + dateKey;
  const existing = attendanceIndex.byKey[key];
  const rowNumber = existing ? existing.rowNumber : Math.max(2, sheet.getLastRow() + 1);
  const rowValues = [[student.no || '', String(student.id), student.name || '', student.room || '', date, String(status)]];

  sheet.getRange(rowNumber, 2).setNumberFormat('@');
  sheet.getRange(rowNumber, 1, 1, 6).setValues(rowValues);
  sheet.getRange(rowNumber, 5).setNumberFormat('dd/MM/yyyy');
  const note = buildAttendanceNote_(reason, teacherLocked);
  sheet.getRange(rowNumber, 6).setNote(note);

  const record = {
    rowNumber: rowNumber,
    id: String(student.id),
    dateKey: dateKey,
    status: String(status),
    note: note,
    reason: getAttendanceReasonFromNote_(note)
  };
  attendanceIndex.byKey[key] = record;
  if (!attendanceIndex.byDate[dateKey]) attendanceIndex.byDate[dateKey] = {};
  attendanceIndex.byDate[dateKey][String(student.id)] = record;
  if (attendanceIndex.dateKeys.indexOf(dateKey) === -1) {
    attendanceIndex.dateKeys.push(dateKey);
    attendanceIndex.dateKeys.sort();
  }
  return record;
}


function getAttendanceForStudent_(attendanceIndex, studentId, dateKey) {
  return attendanceIndex.byKey[String(studentId) + '|' + String(dateKey)] || {
    rowNumber: 0,
    id: String(studentId),
    dateKey: String(dateKey),
    status: 'ไม่ได้เช็ค',
    note: '',
    reason: ''
  };
}

function getTeacherSessionRecord_(teacherId) {

  const id = String(teacherId == null ? '' : teacherId).trim();

  if (id === '21602m2') {

    return {

      id: id,

      name: 'เด็กชายไอยเรศ เตชะเลิศพนา (ผู้ช่วยครูประจำห้อง)',

      room: '205',

      status: 'ผู้ช่วยครู',

      email: '',

      isAdmin: false

    };

  }

  return getTeacherRecordById_(id);

}



function createLoginSession_(role, record) {

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

  const storedRecord = Object.assign({}, record);

  delete storedRecord.sessionToken;

  CacheService.getScriptCache().put(

    'M2_ATTENDANCE_SESSION_' + token,

    JSON.stringify({ role: role, record: storedRecord }),

    21600

  );

  return token;

}



function getLoginSession_(token, expectedRole) {

  const sessionToken = String(token == null ? '' : token).trim();

  if (!sessionToken) throw new Error('ไม่พบเซสชัน กรุณาเข้าสู่ระบบใหม่');

  const raw = CacheService.getScriptCache().get('M2_ATTENDANCE_SESSION_' + sessionToken);

  if (!raw) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

  let session;

  try { session = JSON.parse(raw); } catch (err) { throw new Error('ข้อมูลเซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'); }

  if (session.role !== expectedRole || !session.record) throw new Error('ไม่มีสิทธิ์ใช้งานส่วนนี้');

  return session.record;

}



function getTeacherSessionByToken_(token) {

  const cached = getLoginSession_(token, 'teacher');

  // อ่านสิทธิ์ปัจจุบันจาก InfoTeacher ทุกครั้ง เพื่อให้การเปลี่ยน/เพิกถอน Admin มีผลทันที

  const current = getTeacherSessionRecord_(cached.id);

  if (!current) throw new Error('ไม่พบข้อมูลครู กรุณาเข้าสู่ระบบใหม่');

  return current;

}



function getStudentSessionByToken_(token) {

  const cached = getLoginSession_(token, 'student');

  const current = getStudentRecordById_(cached.id);

  if (!current) throw new Error('ไม่พบข้อมูลนักเรียน กรุณาเข้าสู่ระบบใหม่');

  return current;

}



function getSystemSettings_() {

  const raw = PropertiesService.getScriptProperties().getProperty('M2_ATTENDANCE_SYSTEM_SETTINGS');

  let saved = {};

  if (raw) {

    try { saved = JSON.parse(raw) || {}; } catch (err) { saved = {}; }

  }

  const result = {};

  Object.keys(SYSTEM_DEFAULT_SETTINGS).forEach(key => {

    result[key] = Object.prototype.hasOwnProperty.call(saved, key)

      ? saved[key] === true

      : SYSTEM_DEFAULT_SETTINGS[key];

  });

  return result;

}



function getSystemSettingsForUI(sessionToken) {

  getTeacherSessionByToken_(sessionToken);

  return getSystemSettings_();

}





function saveSystemSettings(sessionToken, submittedSettings) {

  const teacher = getTeacherSessionByToken_(sessionToken);

  if (!teacher.isAdmin) throw new Error('เฉพาะครูที่มี [สถานะ] เป็น Admin เท่านั้นที่ปรับการตั้งค่าระบบได้');

  const incoming = submittedSettings || {};

  const current = getSystemSettings_();

  const safeSettings = {};

  Object.keys(SYSTEM_DEFAULT_SETTINGS).forEach(key => {

    safeSettings[key] = Object.prototype.hasOwnProperty.call(incoming, key) ? incoming[key] === true : current[key];

  });

  PropertiesService.getScriptProperties().setProperty('M2_ATTENDANCE_SYSTEM_SETTINGS', JSON.stringify(safeSettings));

  return { success: true, settings: safeSettings, message: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว' };

}





function getTeacherRecipientsByRoom_(room) {

  const values = getSheetByName('InfoTeacher').getDataRange().getDisplayValues();

  if (values.length < 2) return [];

  const map = getTeacherColumnMap_(values[0]);

  const targetRoom = String(room == null ? '' : room).trim();

  const result = [];

  const seen = {};

  for (let r = 1; r < values.length; r++) {

    const row = values[r];

    if (String(row[map.room] || '').trim() !== targetRoom) continue;

    const email = findEmailInRow_(row, map.email);

    if (!email || seen[email.toLowerCase()]) continue;

    seen[email.toLowerCase()] = true;

    result.push({

      email: email,

      name: String(row[map.name] || 'คุณครู').trim()

    });

  }

  return result;

}



function sendOneEmail_(email, subject, body, htmlBody) {

  if (!isValidEmail_(email)) return false;

  MailApp.sendEmail({

    to: email,

    subject: subject,

    body: body,

    htmlBody: htmlBody || '\<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">' + escapeHtml_(body) + '\</pre>',

    name: 'ระบบเช็คชื่อหน้าเสาธง ม.2'

  });

  return true;

}



// แจ้งผลเฉพาะนักเรียนคนนั้นให้นักเรียนและครูที่ปรึกษาทราบ

function sendStudentAndTeacherStatusEmails_(studentId, status, reason, timeStr) {

  const settings = getSystemSettings_();

  if (!settings.emailNotifications) return { sent: 0, failed: [], skipped: true };

  const student = getStudentRecordById_(studentId);

  if (!student) return { sent: 0, failed: ['ไม่พบข้อมูลนักเรียน'], skipped: false };

  const dateThai = getTodayThaiDate();

  const details = [

    'สรุปการเช็คชื่อหน้าเสาธง ระดับชั้น ม.2',

    'วันที่: ' + dateThai,

    'ห้อง: ' + student.room,

    'เลขประจำตัว: ' + student.id,

    'ชื่อ: ' + student.name,

    'สถานะ: ' + status,

    'เวลา: ' + (timeStr || '-'),

    'เหตุผล/หมายเหตุ: ' + (reason || '-')

  ].join('\n');

  const subject = 'สรุปการเช็คชื่อ ม.2 - ' + student.name + ' (' + dateThai + ')';

  const recipients = [];

  if (student.email) recipients.push({ email: student.email, name: student.name });

  getTeacherRecipientsByRoom_(student.room).forEach(item => recipients.push(item));

  const seen = {};

  const sent = [];

  const failed = [];

  recipients.forEach(recipient => {

    const key = recipient.email.toLowerCase();

    if (seen[key]) return;

    seen[key] = true;

    try {

      sendOneEmail_(recipient.email, subject, details);

      sent.push(recipient.email);

    } catch (err) {

      failed.push(recipient.email + ': ' + err.message);

    }

  });

  return { sent: sent.length, failed: failed, skipped: false };

}



// ส่งสรุปหนึ่งฉบับให้ครู และแจ้งรายบุคคลให้นักเรียนที่ครูเปลี่ยนสถานะ

function sendTeacherBulkSummaryEmails_(teacher, changedRecords) {

  const settings = getSystemSettings_();

  if (!settings.emailNotifications || !changedRecords.length) return { teacherSent: false, studentSent: 0, failed: [], skipped: !settings.emailNotifications };

  const dateThai = getTodayThaiDate();

  const lines = [

    'สรุปผลการเช็คชื่อหน้าเสาธง ระดับชั้น ม.2',

    'วันที่: ' + dateThai,

    'ห้อง: ' + (teacher.room || 'ทุกห้อง'),

    'ครูผู้บันทึก: ' + teacher.name,

    'จำนวนรายการที่มีการเปลี่ยนแปลง: ' + changedRecords.length,

    '----------------------------------------'

  ];

  changedRecords.forEach((item, index) => {

    lines.push((index + 1) + '. ' + item.name + ' (' + item.id + ') : ' + item.status + (item.reason ? ' | ' + item.reason : ''));

  });

  const body = lines.join('\n');

  const subject = 'สรุปการเช็คชื่อ ม.2 ห้อง ' + (teacher.room || 'ภาพรวม') + ' ประจำวันที่ ' + dateThai;

  const failed = [];

  let teacherSent = false;

  try {

    if (teacher.email) teacherSent = sendOneEmail_(teacher.email, subject, body);

  } catch (err) {

    failed.push(teacher.email + ': ' + err.message);

  }

  let studentSent = 0;

  changedRecords.forEach(item => {

    const student = getStudentRecordById_(item.id);

    if (!student || !student.email) return;

    const personalBody = [

      'เรียน ' + student.name,

      'ระบบได้บันทึกข้อมูลการเช็คชื่อหน้าเสาธงของท่านแล้ว',

      'วันที่: ' + dateThai,

      'ห้อง: ' + student.room,

      'สถานะ: ' + item.status,

      'เหตุผล/หมายเหตุ: ' + (item.reason || '-'),

      'ผู้บันทึก: ' + teacher.name

    ].join('\n');

    try {

      if (sendOneEmail_(student.email, 'แจ้งผลการเช็คชื่อ ม.2 - ' + dateThai, personalBody)) studentSent++;

    } catch (err) {

      failed.push(student.email + ': ' + err.message);

    }

  });

  return { teacherSent: teacherSent, studentSent: studentSent, failed: failed, skipped: false };

}



function escapeHtml_(value) {

  return String(value == null ? '' : value)

    .replace(/&/g, '&amp;')

    .replace(/\</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#39;');

}





function generateLateReportData(sessionToken) {
  try {
    const teacher = getTeacherSessionByToken_(sessionToken);
    if (!teacher.isAdmin) return '❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูรายงานภาพรวม ม.2 ได้';
    if (!getSystemSettings_().lateReport) return '❌ ระบบปิดการใช้งานรายงานคนสายโดยแอดมิน';

    const sheet = getAttendanceSheet_();
    const attendanceIndex = getAttendanceIndex_(sheet);
    const todayKey = getAttendanceDateKey_(getTodayDate_());
    const roster = getStudentRoster_();
    const roomSummary = {};
    let totalLateCount = 0;

    roster.forEach(student => {
      if (!student.room) return;
      const attendance = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
      if (attendance.status === 'ขอมาสาย') {
        totalLateCount++;
        if (!roomSummary[student.room]) roomSummary[student.room] = [];
        roomSummary[student.room].push(student.name);
      }
    });

    let textMessage = '🟡 รายงานการมาสาย ม.2\n📅 ประจำวันที่ ' + getTodayThaiDate() + '\n━━━━━━━━━━━━━━━━━━\n';
    if (totalLateCount === 0) textMessage += '✅ วันนี้ไม่มีข้อมูลนักเรียนมาสายในระบบค่ะ\n';
    else {
      Object.keys(roomSummary).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(room => {
        textMessage += '🏫 ห้อง: ' + room + ' -> 🟡 มาสาย: ' + roomSummary[room].length + ' คน\n';
        textMessage += '   📌 รายชื่อ: ' + roomSummary[room].join(', ') + '\n';
      });
      textMessage += '📈 รวมทั้งระดับชั้น: ' + totalLateCount + ' คน\n';
    }
    return textMessage + '━━━━━━━━━━━━━━━━━━\n📢 ส่งรายงานโดย ' + teacher.name;
  } catch (err) {
    return '❌ เกิดข้อผิดพลาดบนเซิร์ฟเวอร์: ' + err.toString();
  }
}

function sendLateReportEmailToAdmins(sessionToken) {

  try {

    const sender = getTeacherSessionByToken_(sessionToken);

    if (!sender.isAdmin) return { success: false, message: '❌ ไม่มีสิทธิ์ส่งรายงานนี้ เฉพาะครูที่มี [สถานะ] เป็น Admin เท่านั้น' };

    const settings = getSystemSettings_();

    if (!settings.emailNotifications || !settings.lateReport) return { success: false, message: '❌ แอดมินปิดการส่งอีเมลหรือปิดรายงานคนสายไว้' };

    const adminInfo = getAdminEmailRecipients_();

    if (!adminInfo.recipients.length) {

      let detail = 'ไม่พบอีเมลของผู้ดูแลระบบที่มี [สถานะ] เป็น Admin ในชีต InfoTeacher';

      if (adminInfo.missingEmailNames.length) detail += ' (ไม่มีอีเมล: ' + adminInfo.missingEmailNames.join(', ') + ')';

      return { success: false, message: '❌ ' + detail };

    }

    const reportText = generateLateReportData(sessionToken);

    if (String(reportText).indexOf('❌') === 0) return { success: false, message: reportText };

    const dateThai = getTodayThaiDate();

    const subject = 'รายงานนักเรียนขอมาสาย ม.2 ประจำวันที่ ' + dateThai;

    const plainBody = reportText + '\n\nส่งโดยระบบเช็คชื่อหน้าเสาธง ม.2';

    const htmlBody = '\<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2937">\<h2 style="color:#b7791f">รายงานนักเรียนขอมาสาย ม.2\</h2>\<p>ประจำวันที่ ' + escapeHtml_(dateThai) + '\</p>\<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0">' + escapeHtml_(reportText) + '\</pre>\<p style="font-size:12px;color:#64748b">ส่งโดยระบบเช็คชื่อหน้าเสาธง ม.2\</p>\</div>';

    const sent = [];

    const failed = [];

    adminInfo.recipients.forEach(recipient => {

      try { sendOneEmail_(recipient.email, subject, plainBody, htmlBody); sent.push(recipient.email); }

      catch (mailError) { failed.push(recipient.email + ' (' + mailError.message + ')'); }

    });

    let message = 'ส่งรายงานคนสายสำเร็จ ' + sent.length + ' จาก ' + adminInfo.recipients.length + ' บัญชี';

    if (failed.length) message += '\nส่งไม่สำเร็จ: ' + failed.join(', ');

    if (adminInfo.missingEmailNames.length) message += '\nไม่พบอีเมลของ Admin: ' + adminInfo.missingEmailNames.join(', ');

    return { success: sent.length > 0 && failed.length === 0, sentCount: sent.length, totalCount: adminInfo.recipients.length, failed: failed, missingEmailNames: adminInfo.missingEmailNames, message: (sent.length > 0 ? '✅ ' : '❌ ') + message };

  } catch (err) {

    return { success: false, message: '❌ เกิดข้อผิดพลาดในการส่งอีเมล: ' + err.message };

  }

}





/**
 * สร้างรายงานประจำวันสำหรับสถานะ ลา / ขาดเรียน / กิจกรรม
 * ใช้รายชื่อนักเรียนจาก InfoStudent และประวัติการเช็คชื่อจาก Data
 */
function buildDailyExceptionReport_() {
  const statusConfig = [
    { value: 'ลา', label: 'ลา', icon: '🔵' },
    { value: 'ขาดเรียน', label: 'ขาดเรียน', icon: '🔴' },
    { value: 'กิจกรรม', label: 'กิจกรรม', icon: '🟣' }
  ];
  const statusMap = {};
  statusConfig.forEach(item => { statusMap[item.value] = item; });

  const roster = getStudentRoster_();
  const attendanceIndex = getAttendanceIndex_(getAttendanceSheet_());
  const todayKey = getAttendanceDateKey_(getTodayDate_());
  const roomGroups = {};
  const totals = { 'ลา': 0, 'ขาดเรียน': 0, 'กิจกรรม': 0 };

  roster.forEach(student => {
    const attendance = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
    const status = String(attendance.status || 'ไม่ได้เช็ค').trim();
    if (!Object.prototype.hasOwnProperty.call(statusMap, status)) return;

    const room = String(student.room || '').trim() || 'ไม่ระบุห้อง';
    if (!roomGroups[room]) {
      roomGroups[room] = { 'ลา': [], 'ขาดเรียน': [], 'กิจกรรม': [] };
    }

    roomGroups[room][status].push({
      no: String(student.no || '-'),
      id: String(student.id || ''),
      name: String(student.name || 'นักเรียน')
    });
    totals[status]++;
  });

  const totalCount = Object.keys(totals).reduce((sum, key) => sum + totals[key], 0);
  const dateThai = getTodayThaiDate();
  const lines = [
    '📋 รายงานนักเรียนลา ขาดเรียน และกิจกรรม ระดับชั้น ม.2',
    '📅 ประจำวันที่ ' + dateThai,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔵 ลา: ' + totals['ลา'] + ' คน',
    '🔴 ขาดเรียน: ' + totals['ขาดเรียน'] + ' คน',
    '🟣 กิจกรรม: ' + totals['กิจกรรม'] + ' คน',
    '📊 รวมทั้งหมด: ' + totalCount + ' คน',
    '━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  const roomNames = Object.keys(roomGroups).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'th');
  });

  if (!roomNames.length || totalCount === 0) {
    lines.push('✅ ไม่พบข้อมูลนักเรียนลา ขาดเรียน หรือกิจกรรมในวันนี้');
  } else {
    roomNames.forEach(room => {
      const group = roomGroups[room];
      const roomTotal = statusConfig.reduce((sum, item) => sum + group[item.value].length, 0);
      if (!roomTotal) return;
      lines.push('🏫 ห้อง ' + room + ' (' + roomTotal + ' คน)');

      statusConfig.forEach(item => {
        const students = group[item.value];
        if (!students.length) return;
        lines.push(item.icon + ' ' + item.label + ' (' + students.length + ' คน)');
        students.sort((a, b) => {
          const na = parseInt(a.no, 10);
          const nb = parseInt(b.no, 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.name.localeCompare(b.name, 'th');
        });
        students.forEach(student => {
          lines.push('   • เลขที่ ' + student.no + ' ' + student.name +
            (student.id ? ' (' + student.id + ')' : ''));
        });
      });
      lines.push('----------------------------------------');
    });
  }

  return {
    text: lines.join('\n'),
    dateThai: dateThai,
    totals: totals,
    totalCount: totalCount,
    roomCount: roomNames.length
  };
}

/** ส่งรายงาน 3 สถานะ (ลา / ขาดเรียน / กิจกรรม) ไปยังอีเมลของครูทุกคนที่ InfoTeacher[สถานะ] = Admin */
function sendDailyExceptionsEmailToAdmins(sessionToken) {
  try {
    const sender = getTeacherSessionByToken_(sessionToken);
    if (!sender.isAdmin) {
      return { success: false, message: '❌ ไม่มีสิทธิ์ส่งรายงานนี้ เฉพาะครูที่มี [สถานะ] เป็น Admin เท่านั้น' };
    }

    const settings = getSystemSettings_();
    if (!settings.emailNotifications) {
      return { success: false, message: '❌ แอดมินปิดระบบส่ง E-mail อยู่' };
    }
    if (!settings.dailyExceptionEmailReport) {
      return { success: false, message: '❌ แอดมินปิดปุ่มส่งรายงานลา ขาดเรียน และกิจกรรมไว้' };
    }

    const adminInfo = getAdminEmailRecipients_();
    if (!adminInfo.recipients.length) {
      let detail = 'ไม่พบอีเมลของผู้ดูแลระบบที่มี [สถานะ] เป็น Admin ในชีต InfoTeacher';
      if (adminInfo.missingEmailNames.length) {
        detail += ' (ไม่มีอีเมล: ' + adminInfo.missingEmailNames.join(', ') + ')';
      }
      return { success: false, message: '❌ ' + detail };
    }

    const report = buildDailyExceptionReport_();
    const subject = 'รายงานนักเรียนลา ขาดเรียน และกิจกรรม ม.2 ประจำวันที่ ' + report.dateThai;
    const plainBody = report.text + '\n\nส่งรายงานโดย ' + sender.name + '\nระบบเช็คชื่อหน้าเสาธงระดับชั้น ม.2';
    const htmlBody = '<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2937">' +
      '<h2 style="color:#1e3c72">รายงานนักเรียนลา ขาดเรียน และกิจกรรม ม.2</h2>' +
      '<p>ประจำวันที่ ' + escapeHtml_(report.dateThai) + '</p>' +
      '<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0">' +
      escapeHtml_(report.text) + '</pre>' +
      '<p style="font-size:12px;color:#64748b">ส่งรายงานโดย ' + escapeHtml_(sender.name) + ' ผ่านระบบเช็คชื่อหน้าเสาธง ม.2</p>' +
      '</div>';

    const sent = [];
    const failed = [];
    adminInfo.recipients.forEach(recipient => {
      try {
        sendOneEmail_(recipient.email, subject, plainBody, htmlBody);
        sent.push(recipient.email);
      } catch (mailError) {
        failed.push(recipient.email + ' (' + mailError.message + ')');
      }
    });

    let message = 'ส่งรายงานสำเร็จ ' + sent.length + ' จาก ' + adminInfo.recipients.length + ' บัญชี';
    if (failed.length) message += '\nส่งไม่สำเร็จ: ' + failed.join(', ');
    if (adminInfo.missingEmailNames.length) {
      message += '\nไม่พบอีเมลของ Admin: ' + adminInfo.missingEmailNames.join(', ');
    }

    return {
      success: sent.length > 0 && failed.length === 0,
      sentCount: sent.length,
      totalCount: adminInfo.recipients.length,
      totals: report.totals,
      failed: failed,
      missingEmailNames: adminInfo.missingEmailNames,
      message: (sent.length > 0 ? '✅ ' : '❌ ') + message
    };
  } catch (err) {
    return { success: false, message: '❌ เกิดข้อผิดพลาดในการส่งรายงาน: ' + err.message };
  }
}

function generateAbsentLeaveReportData(sessionToken) {
  try {
    const teacher = getTeacherSessionByToken_(sessionToken);
    if (!teacher.isAdmin) return '❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูรายงานภาพรวม ม.2 ได้';
    if (!getSystemSettings_().absentLeaveReport) return '❌ ระบบปิดการใช้งานรายงานขาด/ลาโดยแอดมิน';

    const attendanceIndex = getAttendanceIndex_(getAttendanceSheet_());
    const todayKey = getAttendanceDateKey_(getTodayDate_());
    const roster = getStudentRoster_();
    const roomSummary = {};
    let totalAbsentCount = 0;
    let totalLeaveCount = 0;

    roster.forEach(student => {
      if (!student.room) return;
      const attendance = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
      if (!roomSummary[student.room]) roomSummary[student.room] = { absents: [], leaves: [] };
      if (attendance.status === 'ขาดเรียน') {
        roomSummary[student.room].absents.push(student.name);
        totalAbsentCount++;
      } else if (attendance.status === 'ลา') {
        roomSummary[student.room].leaves.push(student.name);
        totalLeaveCount++;
      }
    });

    let textMessage = '📊 รายงานนักเรียน ขาด-ลา ม.2\n📅 ประจำวันที่ ' + getTodayThaiDate() + '\n━━━━━━━━━━━━━━━━━━\n';
    if (!totalAbsentCount && !totalLeaveCount) textMessage += '✅ วันนี้ไม่มีข้อมูลนักเรียนขาดเรียนหรือลาในระบบค่ะ\n';
    else {
      Object.keys(roomSummary).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(room => {
        const absent = roomSummary[room].absents;
        const leave = roomSummary[room].leaves;
        if (absent.length || leave.length) {
          textMessage += '🏫 ห้อง: ' + room + '\n';
          if (absent.length) textMessage += '   🔴 ขาดเรียน: ' + absent.length + ' คน (' + absent.join(', ') + ')\n';
          if (leave.length) textMessage += '   🔵 ลา: ' + leave.length + ' คน (' + leave.join(', ') + ')\n';
          textMessage += '----------------------------------\n';
        }
      });
      textMessage += '📈 สรุปรวมวันนี้: 🔴 ขาด ' + totalAbsentCount + ' คน | 🔵 ลา ' + totalLeaveCount + ' คน\n';
    }
    return textMessage + '━━━━━━━━━━━━━━━━━━\n📢 ส่งรายงานโดย ' + teacher.name;
  } catch (err) {
    return '❌ เกิดข้อผิดพลาดบนเซิร์ฟเวอร์: ' + err.toString();
  }
}

function generateRoomDynamicReportData(roomNumber, typeText, sessionToken) {
  try {
    const teacher = getTeacherSessionByToken_(sessionToken);
    if (!getSystemSettings_().roomReport) return '❌ ระบบปิดการใช้งานรายงานรายห้องโดยแอดมิน';
    const targetRoom = String(roomNumber == null ? '' : roomNumber).trim();
    if (!teacher.isAdmin && teacher.room !== targetRoom) return '❌ ไม่มีสิทธิ์เรียกดูข้อมูลห้องนี้';

    const attendanceIndex = getAttendanceIndex_(getAttendanceSheet_());
    const todayKey = getAttendanceDateKey_(getTodayDate_());
    const roster = getStudentRoster_().filter(student => student.room === targetRoom);
    const lists = { late: [], absent: [], leave: [], activity: [], uncheck: [] };
    roster.forEach(student => {
      const attendance = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
      if (attendance.status === 'ขอมาสาย') lists.late.push(student.name);
      else if (attendance.status === 'ขาดเรียน') lists.absent.push(student.name);
      else if (attendance.status === 'ลา') lists.leave.push(student.name);
      else if (attendance.status === 'กิจกรรม') lists.activity.push(student.name);
      else if (attendance.status === 'ไม่ได้เช็ค') lists.uncheck.push(student.name);
    });

    let out = typeText + '\n📅 ประจำ' + getTodayThaiDate() + '\n━━━━━━━━━━━━━━━━━━\n';
    out += '🔴 ขาดเรียน (' + lists.absent.length + ' คน):\n' + (lists.absent.length ? '📌 ' + lists.absent.join(', ') : '   - ไม่มี -') + '\n\n';
    out += '🔵 ลาเรียน (' + lists.leave.length + ' คน):\n' + (lists.leave.length ? '📌 ' + lists.leave.join(', ') : '   - ไม่มี -') + '\n\n';
    out += '🟡 ขอมาสาย (' + lists.late.length + ' คน):\n' + (lists.late.length ? '📌 ' + lists.late.join(', ') : '   - ไม่มี -') + '\n\n';
    out += '🟣 กิจกรรม (' + lists.activity.length + ' คน):\n' + (lists.activity.length ? '📌 ' + lists.activity.join(', ') : '   - ไม่มี -') + '\n\n';
    out += '⚪ ไม่ได้เช็ค (' + lists.uncheck.length + ' คน):\n' + (lists.uncheck.length ? '📌 ' + lists.uncheck.join(', ') : '   - ไม่มี -') + '\n━━━━━━━━━━━━━━━━━━\n';
    return out + '💡 หากข้อมูลไม่ถูกต้องหรือมีข้อสงสัย ประสานติดต่อคุณครูที่ปรึกษาได้ทันทีครับ';
  } catch (err) {
    return '❌ เกิดข้อผิดพลาดบนเซิร์ฟเวอร์: ' + err.toString();
  }
}

function generateCustomParentReport(roomNumber, startDateStr, endDateStr, studentIdFilter, statuses, teacherId) {
  try {
    const teacher = getTeacherSessionByToken_(teacherId);
    if (!teacher) return '❌ กรุณาเข้าสู่ระบบครูก่อนเรียกดูรายงาน';
    if (!getSystemSettings_().customParentReport) return '❌ ระบบปิดการใช้งานรายงานย้อนหลังโดยแอดมิน';

    const targetRoom = String(roomNumber == null ? '' : roomNumber).trim();
    if (!teacher.isAdmin && teacher.room !== targetRoom) return '❌ ไม่มีสิทธิ์เรียกดูข้อมูลห้องนี้';
    if (!startDateStr || !endDateStr) return '❌ กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด';

    const parseInputDate = value => {
      const parts = String(value).split('-');
      if (parts.length !== 3) return parseAttendanceDate_(value, value);
      return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0));
    };
    const startDate = parseInputDate(startDateStr);
    const endDate = parseInputDate(endDateStr);
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return '❌ ช่วงวันที่ไม่ถูกต้อง';
    }

    const startKey = getAttendanceDateKey_(startDate);
    const endKey = getAttendanceDateKey_(endDate);
    const startThai = startDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: APP_TIME_ZONE });
    const endThai = endDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: APP_TIME_ZONE });
    const attendanceIndex = getAttendanceIndex_(getAttendanceSheet_());
    const dateKeys = attendanceIndex.dateKeys.filter(key => key >= startKey && key <= endKey);
    if (!dateKeys.length) return '❌ ไม่พบข้อมูลการเช็คชื่อในช่วงวันที่ที่ระบุ';

    const roster = getStudentRoster_();
    const reportObj = {};
    const selectedStatuses = Array.isArray(statuses) ? statuses.map(String) : [];

    roster.forEach(student => {
      if (student.room !== targetRoom) return;
      if (studentIdFilter !== 'all' && student.id !== String(studentIdFilter)) return;

      dateKeys.forEach(dateKey => {
        const attendance = getAttendanceForStudent_(attendanceIndex, student.id, dateKey);
        if (selectedStatuses.indexOf(attendance.status) === -1) return;
        if (!reportObj[student.id]) {
          reportObj[student.id] = { name: student.name, no: student.no || '99', records: [] };
        }
        reportObj[student.id].records.push({ date: formatAttendanceDateThai_(dateKey), status: attendance.status });
      });
    });

    let textMessage = '📅 สรุปข้อมูลการเข้าแถว (แจ้งผู้ปกครอง)\n🗓️ ช่วงวันที่: ' + startThai + ' ถึง ' + endThai + '\n🏫 ห้อง: ' + targetRoom + '\n';
    if (studentIdFilter !== 'all') {
      const requestedStudent = getStudentRecordById_(studentIdFilter);
      textMessage += '👤 นักเรียน: ' + (requestedStudent ? requestedStudent.name : studentIdFilter) + '\n';
    }
    textMessage += '━━━━━━━━━━━━━━━━━━\n';

    const studentKeys = Object.keys(reportObj).sort((a, b) => (parseInt(reportObj[a].no, 10) || 0) - (parseInt(reportObj[b].no, 10) || 0));
    if (!studentKeys.length) {
      textMessage += '✅ ไม่พบข้อมูลสถานะที่ถูกเลือกในช่วงเวลาดังกล่าว\n';
    } else {
      studentKeys.forEach(studentId => {
        const item = reportObj[studentId];
        textMessage += '📌 เลขที่ ' + item.no + ' ' + item.name + '\n';
        item.records.forEach(record => {
          let icon = '⚪';
          if (record.status === 'ขอมาสาย') icon = '🟡';
          else if (record.status === 'ลา') icon = '🔵';
          else if (record.status === 'ขาดเรียน') icon = '🔴';
          else if (record.status === 'กิจกรรม') icon = '🟣';
          textMessage += '   ' + icon + ' ' + record.date + ' : ' + record.status + '\n';
        });
        textMessage += '\n';
      });
    }

    textMessage += '━━━━━━━━━━━━━━━━━━\n💡 หากมีข้อสงสัย สามารถประสานติดต่อคุณครูที่ปรึกษาได้ทันทีครับ';
    return textMessage;
  } catch (err) {
    return '❌ ข้อผิดพลาดบนเซิร์ฟเวอร์: ' + err.toString();
  }
}

function verifyStudentId(studentId) {

  if (!getSystemSettings_().studentLogin) throw new Error('ระบบปิดการเข้าสู่ระบบของนักเรียนโดยแอดมิน');

  const student = getStudentRecordById_(studentId);

  if (!student) return null;

  student.sessionToken = createLoginSession_('student', student);

  return student;

}





function saveWebData(sessionToken, status, reason) {
  try {
    if (!getSystemSettings_().studentSelfCheck) return '❌ ระบบปิดการบันทึกข้อมูลด้วยตนเองของนักเรียนโดยแอดมิน';
    const student = getStudentSessionByToken_(sessionToken);
    const allowedStatuses = ['มาแล้ว', 'ขอมาสาย', 'ลา', 'ขาดเรียน', 'กิจกรรม'];
    const selectedStatus = String(status == null ? '' : status).trim();
    if (allowedStatuses.indexOf(selectedStatus) === -1) return '❌ สถานะการเข้าแถวไม่ถูกต้อง';

    const sheet = getAttendanceSheet_();
    const attendanceIndex = getAttendanceIndex_(sheet);
    const todayDate = getTodayDate_();
    const todayKey = getAttendanceDateKey_(todayDate);
    const current = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
    if (isTeacherLockedAttendance_(current.note)) {
      return '⚠️ ข้อมูลนี้ผ่านการเช็คและบันทึกโดยคุณครูที่ปรึกษาเรียบร้อยแล้ว ไม่สามารถแก้ไขได้';
    }

    upsertAttendanceRecord_(sheet, student, todayDate, selectedStatus, reason || '', false, attendanceIndex);
    const timeStr = Utilities.formatDate(new Date(), APP_TIME_ZONE, 'HH:mm');
    let emailMessage = '';
    try {
      const mailResult = sendStudentAndTeacherStatusEmails_(student.id, selectedStatus, reason || '', timeStr);
      if (mailResult.skipped) emailMessage = ' (ปิดการส่ง E-mail อยู่)';
      else if (mailResult.sent) emailMessage = ' (ส่งสรุป E-mail แล้ว ' + mailResult.sent + ' ฉบับ)';
      else if (mailResult.failed && mailResult.failed.length) emailMessage = ' (บันทึกสำเร็จ แต่ส่ง E-mail ไม่สำเร็จ)';
    } catch (mailError) {
      emailMessage = ' (บันทึกสำเร็จ แต่ระบบส่ง E-mail ขัดข้อง)';
    }
    return '🟢 บันทึกข้อมูลเข้าเรียนสำเร็จเรียบร้อยครับ!' + emailMessage;
  } catch (err) {
    return '❌ ' + err.message;
  }
}

function verifyTeacherId(inputPassword) {

  const pwd = String(inputPassword == null ? '' : inputPassword).trim();

  // บัญชีผู้ช่วยครูแบบกำหนดไว้เดิมยังเข้าสู่ระบบได้ตามเดิม
  const teacher = pwd === '21602m2'
    ? getTeacherSessionRecord_(pwd)
    : getTeacherRecordByLoginPassword_(pwd);

  if (!teacher) return null;

  const settings = getSystemSettings_();

  if (!teacher.isAdmin && !settings.teacherLogin) throw new Error('ระบบปิดการเข้าสู่ระบบของครูโดยแอดมิน');

  teacher.todayThaiDate = getTodayThaiDate();
  teacher.sessionToken = createLoginSession_('teacher', teacher);

  return teacher;

}





/** ครูสามารถแก้ไขชื่อและรหัสผ่านของบัญชีตนเองหลังเข้าสู่ระบบ */
function updateTeacherOwnProfile(sessionToken, currentPassword, newName, newPassword, confirmPassword) {
  const teacher = getTeacherSessionByToken_(sessionToken);
  const currentPwd = String(currentPassword == null ? '' : currentPassword).trim();
  const updatedName = String(newName == null ? '' : newName).trim();
  const updatedPassword = String(newPassword == null ? '' : newPassword).trim();
  const confirmedPassword = String(confirmPassword == null ? '' : confirmPassword).trim();

  if (!currentPwd) throw new Error('กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน');
  if (!updatedName) throw new Error('กรุณากรอกชื่อครู');
  if (updatedName.length > 100) throw new Error('ชื่อครูต้องไม่เกิน 100 ตัวอักษร');
  if (updatedPassword) {
    if (updatedPassword.length < 4 || updatedPassword.length > 64) {
      throw new Error('รหัสผ่านใหม่ต้องมีความยาว 4–64 ตัวอักษร');
    }
    if (updatedPassword !== confirmedPassword) throw new Error('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('มีการแก้ไขข้อมูลบัญชีพร้อมกัน กรุณาลองใหม่อีกครั้ง');

  try {
    const sheet = getSheetByName('InfoTeacher');
    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) throw new Error('ไม่พบข้อมูลครูในชีต InfoTeacher');

    const map = getTeacherColumnMap_(values[0]);
    if (map.status < 0) throw new Error('ไม่พบคอลัมน์ [สถานะ] ในชีต InfoTeacher');
    if (map.name < 0 || map.password < 0 || map.id < 0) {
      throw new Error('ไม่พบคอลัมน์ชื่อครูหรือรหัสผ่านที่จำเป็นในชีต InfoTeacher');
    }

    let rowNumber = -1;
    let currentRow = null;
    for (let r = 1; r < values.length; r++) {
      const rowId = String(values[r][map.id] == null ? '' : values[r][map.id]).trim();
      if (rowId === String(teacher.id).trim()) {
        rowNumber = r + 1;
        currentRow = values[r];
        break;
      }
    }
    if (rowNumber < 0 || !currentRow) {
      throw new Error('ไม่พบแถวข้อมูลบัญชีของคุณใน InfoTeacher บัญชีนี้อาจเป็นบัญชีพิเศษที่ไม่ได้เก็บในชีต');
    }

    const storedPassword = String(currentRow[map.password] == null ? '' : currentRow[map.password]).trim();
    const effectiveCurrentPassword = storedPassword || String(currentRow[map.id] || '').trim();
    if (effectiveCurrentPassword !== currentPwd) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');

    if (updatedPassword) {
      for (let r = 1; r < values.length; r++) {
        if (r + 1 === rowNumber) continue;
        const otherStoredPassword = String(values[r][map.password] == null ? '' : values[r][map.password]).trim();
        const otherId = String(values[r][map.id] == null ? '' : values[r][map.id]).trim();
        const otherEffectivePassword = otherStoredPassword || otherId;
        if (otherEffectivePassword && otherEffectivePassword === updatedPassword) {
          throw new Error('รหัสผ่านใหม่นี้ถูกใช้โดยบัญชีครูคนอื่นแล้ว กรุณากำหนดรหัสผ่านใหม่');
        }
      }
    }

    // แก้ไขเฉพาะชื่อและรหัสผ่านของแถวตนเอง ไม่เปลี่ยนห้อง อีเมล หรือสถานะ Admin
    sheet.getRange(rowNumber, map.name + 1).setValue(updatedName);
    if (updatedPassword) {
      sheet.getRange(rowNumber, map.password + 1).setNumberFormat('@');
      sheet.getRange(rowNumber, map.password + 1).setValue(updatedPassword);
    }
    SpreadsheetApp.flush();

    // เมื่อระบบเดิมใช้คอลัมน์รหัสครูเป็นรหัสผ่าน ต้องออกเซสชันใหม่ด้วยรหัสครูที่เพิ่งเปลี่ยน
    const newTeacherId = map.password === map.id && updatedPassword ? updatedPassword : String(teacher.id);
    const updatedTeacher = getTeacherRecordById_(newTeacherId);
    if (!updatedTeacher) throw new Error('บันทึกข้อมูลแล้ว แต่ไม่สามารถโหลดข้อมูลบัญชีใหม่ได้ กรุณาเข้าสู่ระบบใหม่');

    updatedTeacher.todayThaiDate = getTodayThaiDate();
    updatedTeacher.sessionToken = createLoginSession_('teacher', updatedTeacher);

    return {
      success: true,
      teacher: updatedTeacher,
      message: updatedPassword
        ? 'เปลี่ยนชื่อและรหัสผ่านเรียบร้อยแล้ว'
        : 'เปลี่ยนชื่อครูเรียบร้อยแล้ว (คงรหัสผ่านเดิม)'
    };
  } finally {
    lock.releaseLock();
  }
}


function getTeacherReportData(roomNumber, sessionToken) {
  const teacher = getTeacherSessionByToken_(sessionToken);
  const targetRoom = String(roomNumber == null ? '' : roomNumber).trim();
  if (!teacher.isAdmin && teacher.room !== targetRoom) throw new Error('ไม่มีสิทธิ์เรียกดูข้อมูลห้องนี้');
  const allRooms = teacher.isAdmin && !targetRoom;
  const todayKey = getAttendanceDateKey_(getTodayDate_());
  const attendanceIndex = getAttendanceIndex_(getAttendanceSheet_());
  const reportList = [];

  getStudentRoster_().forEach(student => {
    if (!student.room || (!allRooms && student.room !== targetRoom)) return;
    const attendance = getAttendanceForStudent_(attendanceIndex, student.id, todayKey);
    reportList.push({
      no: student.no || '-',
      id: student.id,
      name: student.name,
      room: student.room,
      status: attendance.status,
      reason: attendance.reason
    });
  });

  reportList.sort((a, b) => {
    const roomCompare = String(a.room).localeCompare(String(b.room), 'th');
    if (roomCompare !== 0) return roomCompare;
    return (parseInt(a.no, 10) || 0) - (parseInt(b.no, 10) || 0);
  });
  return reportList;
}

function updateBulkStatusByTeacher(recordsJson, teacherId) {
  try {
    const teacher = getTeacherSessionByToken_(teacherId);
    if (!teacher) return '❌ กรุณาเข้าสู่ระบบครูก่อนบันทึกข้อมูล';
    if (!getSystemSettings_().teacherAttendance) return '❌ ระบบปิดการเช็คชื่อและบันทึกข้อมูลโดยครู';

    const records = JSON.parse(recordsJson || '[]');
    if (!Array.isArray(records)) return '❌ รูปแบบข้อมูลไม่ถูกต้อง';

    const sheet = getAttendanceSheet_();
    const roster = getStudentRoster_();
    const studentMap = {};
    roster.forEach(student => { studentMap[student.id] = student; });
    const attendanceIndex = getAttendanceIndex_(sheet);
    const todayDate = getTodayDate_();
    const todayKey = getAttendanceDateKey_(todayDate);
    let updatedCount = 0;
    const changedRecords = [];
    const processed = {};
    const allowedStatuses = ['มาแล้ว', 'ขอมาสาย', 'ลา', 'ขาดเรียน', 'กิจกรรม', 'ไม่ได้เช็ค'];

    records.forEach(record => {
      const targetId = String(record.id == null ? '' : record.id).trim();
      const newStatus = String(record.status == null ? '' : record.status).trim();
      if (!targetId || processed[targetId] || allowedStatuses.indexOf(newStatus) === -1) return;
      processed[targetId] = true;

      const student = studentMap[targetId];
      if (!student) return;
      if (!teacher.isAdmin && student.room !== teacher.room) return;

      const current = getAttendanceForStudent_(attendanceIndex, targetId, todayKey);
      const teacherLocked = newStatus !== 'มาแล้ว' && newStatus !== 'ไม่ได้เช็ค';
      const newNote = buildAttendanceNote_(teacherLocked ? 'บันทึกโดยคุณครู' : '', teacherLocked);
      if (current.status === newStatus && current.note === newNote) return;

      upsertAttendanceRecord_(sheet, student, todayDate, newStatus, teacherLocked ? 'บันทึกโดยคุณครู' : '', teacherLocked, attendanceIndex);
      updatedCount++;
      changedRecords.push({
        id: targetId,
        no: student.no || '',
        name: student.name,
        room: student.room,
        status: newStatus,
        reason: teacherLocked ? 'บันทึกโดยคุณครู' : ''
      });
    });

    let emailNote = '';
    if (updatedCount > 0) {
      try {
        const mailResult = sendTeacherBulkSummaryEmails_(teacher, changedRecords);
        if (mailResult.skipped) emailNote = ' (ปิดการส่ง E-mail อยู่)';
        else emailNote = ' (ส่ง E-mail ถึงครู ' + (mailResult.teacherSent ? '1' : '0') + ' ฉบับ และนักเรียน ' + mailResult.studentSent + ' คน)';
        if (mailResult.failed.length) emailNote += ' มีอีเมลส่งไม่สำเร็จ ' + mailResult.failed.length + ' รายการ';
      } catch (mailError) {
        emailNote = ' (บันทึกสำเร็จ แต่การส่ง E-mail ขัดข้อง)';
      }
    }
    return '🟢 บันทึกข้อมูลนักเรียนสำเร็จ ' + updatedCount + ' รายการเรียบร้อยแล้ว' + emailNote;
  } catch (err) {
    return '❌ เกิดข้อผิดพลาด: ' + err.toString();
  }
}

function getTodayThaiDate() {

  return new Date().toLocaleDateString('th-TH', {

    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: APP_TIME_ZONE

  });

}





function getHtmlContent() {



  return `\<!DOCTYPE html>\<html>\<head>\<meta charset="UTF-8">\<link rel="preconnect" href="https\://fonts.googleapis.com">\<link rel="preconnect" href="https\://fonts.gstatic.com" crossorigin>\<link href="https\://fonts.googleapis.com/css2?family=Sarabun:wght\@300;400;500;700&display=swap" rel="stylesheet">



  \<style>



  body { font-family: 'Sarabun', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); margin: 0; padding: 20px; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }



  .card { background: white; padding: 35px 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 100%; max-width: 850px; text-align: center; box-sizing: border-box; margin-bottom: 20px; }



  h2 { color: #1e3c72; margin-bottom: 10px; font-weight: 700; letter-spacing: 0.5px; }



  .date-badge { display: inline-block; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); color: #0369a1; padding: 8px 18px; border-radius: 25px; font-size: 14px; font-weight: 600; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }



  .role-container { display: flex; gap: 12px; margin-bottom: 25px; }



  .role-btn { flex: 1; padding: 14px; border: 2px solid #e2e8f0; background: #fff; border-radius: 12px; cursor: pointer; font-size: 16px; font-weight: 600; font-family: 'Sarabun', sans-serif; color: #64748b; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }



  .role-btn.active { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; border-color: #1e3c72; box-shadow: 0 4px 15px rgba(30,60,114,0.3); }



  input, select { width: 100%; padding: 14px; margin: 12px 0; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; font-family: 'Sarabun', sans-serif; background-color: #f8fafc; transition: all 0.2s; }



  input:focus, select:focus { outline: none; border-color: #2a5298; background-color: #fff; box-shadow: 0 0 0 3px rgba(42,82,152,0.1); }



  button.submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: 700; font-family: 'Sarabun', sans-serif; box-shadow: 0 4px 12px rgba(17,153,142,0.2); transition: all 0.2s; }



  button.submit-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(17,153,142,0.3); }



  .status-btn { width: 100%; padding: 14px; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: 700; font-family: 'Sarabun', sans-serif; transition: all 0.2s; }



  .admin-btn-group { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }

  .teacher-menu-stack { display: flex; flex-direction: column; gap: 10px; margin: 16px 0 6px; text-align: left; }
  .teacher-menu-item { width: 100%; }
  .teacher-menu-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border: 1px solid #dbe4f0; border-radius: 12px; background: linear-gradient(135deg, #f8fafc 0%, #eef4fb 100%); color: #1e3c72; font-family: 'Sarabun', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; text-align: left; box-shadow: 0 2px 7px rgba(15,23,42,0.04); }
  .teacher-menu-toggle:hover { background: #eaf2fb; border-color: #b7c8df; }
  .teacher-menu-arrow { font-size: 14px; color: #64748b; transition: transform 0.2s; }
  .teacher-menu-panel { margin-top: 8px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
  .teacher-menu-panel[hidden] { display: none !important; }

  .admin-settings { margin-top: 18px; padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; text-align: left; }

  .admin-settings h3 { margin: 0 0 8px; color: #1e3c72; font-size: 17px; }

  .setting-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; }

  .setting-row:last-child { border-bottom: 0; }

  .setting-row input { width: 18px; height: 18px; margin: 2px 0 0; flex: 0 0 18px; }

  .setting-state { font-size: 12px; color: #64748b; margin-left: auto; white-space: nowrap; }

  .teacher-profile-panel { margin-top: 14px; padding: 14px; background: #f8fafc; border: 1px solid #dbe4f0; border-radius: 14px; text-align: left; }

  .teacher-profile-panel h3 { margin: 0 0 8px; color: #1e3c72; font-size: 16px; }

  .teacher-profile-form { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }

  .teacher-profile-form label { display: block; margin-top: 8px; color: #475569; font-size: 13px; font-weight: 600; }

  .teacher-profile-form input { margin: 5px 0 8px; }

  .profile-help { color: #64748b; font-size: 12px; line-height: 1.5; margin: 5px 0; }

  #message { margin-top: 20px; font-weight: 600; font-size: 16px; color: #1e293b; }



  .summary-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }



  @media(max-width: 500px){ .summary-container { grid-template-columns: repeat(2, 1fr); } }



  .summary-card { padding: 12px 8px; border-radius: 12px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center; }



  .summary-card span { display: block; font-size: 22px; font-weight: 700; margin-top: 4px; }



  .sum-all { background-color: #f1f5f9; color: #334155; border-color: #cbd5e1; }



  .sum-present { background-color: #f0fdf4; color: #166534; }



  .sum-late { background-color: #fffbeb; color: #92400e; }



  .sum-leave { background-color: #f0f9ff; color: #075985; }



  .sum-absent { background-color: #fef2f2; color: #991b1b; }



  .sum-activity { background-color: #faf5ff; color: #6b21a8; }



  .sum-uncheck { background-color: #f8fafc; color: #475569; border: 1px dashed #cbd5e1; }



  .summary-card.selected { border-color: #2a5298 !important; transform: scale(1.03); box-shadow: 0 8px 16px rgba(42,82,152,0.15); }



  .scroll-div { margin-top: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; overflow-x: auto; }



  .report-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; min-width: 550px; }



  .report-table th, .report-table td { border-bottom: 1px solid #f1f5f9; padding: 12px 8px; box-sizing: border-box; }



  .report-table th { background-color: #f8fafc; text-align: center; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }



  .badge-group { display: flex; flex-wrap: wrap; gap: 4px; width: 100%; min-height: 32px; }



  .badge-btn { flex: 1; min-width: 54px; text-align: center; padding: 6px 2px; font-size: 11.5px; font-weight: 600; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; color: #64748b; cursor: pointer; font-family: 'Sarabun', sans-serif; transition: all 0.15s; box-sizing: border-box; }



  .badge-btn.active[data-val="มาแล้ว"] { background-color: #2ecc71; color: white; border-color: #2ecc71; }



  .badge-btn.active[data-val="ขอมาสาย"] { background-color: #f1c40f; color: #333; border-color: #f1c40f; }



  .badge-btn.active[data-val="ลา"] { background-color: #3498db; color: white; border-color: #3498db; }



  .badge-btn.active[data-val="ขาดเรียน"] { background-color: #e74c3c; color: white; border-color: #e74c3c; }



  .badge-btn.active[data-val="กิจกรรม"] { background-color: #9b59b6; color: white; border-color: #9b59b6; }



  .badge-btn.active[data-val="ไม่ได้เช็ค"] { background-color: #7f8c8d; color: white; border-color: #7f8c8d; }







  .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); backdrop-filter: blur(4px); animation: fadeIn 0.3s; }



  .modal-content { background-color: #fff; margin: 5% auto; padding: 25px; border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 15px 30px rgba(0,0,0,0.2); text-align: left; position: relative; animation: slideUp 0.3s; box-sizing: border-box; }



  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }



  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }



  .close-modal { position: absolute; right: 20px; top: 15px; font-size: 28px; font-weight: bold; color: #aaa; cursor: pointer; }



  .close-modal:hover { color: #333; }







  #reportTextarea, #customReportResult { width: 100%; height: auto; min-height: 150px; overflow-y: hidden; font-family: 'Sarabun', sans-serif; font-size: 14px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background-color: #f8fafc; resize: none; margin-top: 10px; line-height: 1.5; box-sizing: border-box; }



  #reportTextarea:focus, #customReportResult:focus { outline: none; border-color: #1e3c72; }



  .copy-success-tip { color: #11998e; font-size: 13px; font-weight: 600; margin-top: 5px; display: none; text-align: center; }



  \</style>\</head>\<body>



  \<div class="card">\<h2>📝 ระบบเช็คชื่อหน้าเสาธง ม.2\</h2>\<div id="globalDateBadge" class="date-badge">📅 กำลังโหลดข้อมูล...\</div>\<div id="loginSection">\<div class="role-container">\<button type="button" id="btnStudent" class="role-btn active" onclick="setRole('student')">👨‍🎓 นักเรียน\</button>\<button type="button" id="btnTeacher" class="role-btn" onclick="setRole('teacher')">👩‍🏫 คุณครู\</button>\</div>\<input type="text" id="loginId" placeholder="กรอกเลขประจำตัวนักเรียน 5 หลัก" list="teacherHistory">\<datalist id="teacherHistory">\</datalist>\<button class="submit-btn" onclick="handleLogin()">เข้าสู่ระบบ\</button>\</div>\<div id="studentSection" style="display:none;">\<p id="studentName" style="font-weight: bold; color: #333; margin-bottom: 15px;">\</p>\<select id="status" onchange="toggleReason()">\<option value="มาแล้ว">🟢 มาแล้ว\</option>\<option value="ขอมาสาย">🟡 ขอมาสาย\</option>\<option value="ลา">🔵 ลา\</option>\<option value="ขาดเรียน">🔴 ขาดเรียน\</option>\<option value="กิจกรรม">🟣 กิจกรรม\</option>\</select>\<input type="text" id="reason" placeholder="ระบุเหตุผล (ถ้ามี)" style="display:none;">\<button class="status-btn" style="background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%);" onclick="submitStudentData()">บันทึกข้อมูลการเข้าแถว\</button>\</div>\<div id="teacherSection" style="display:none;">\<p id="teacherName" style="font-weight: bold; color: #1e3c72; margin-bottom: 5px; font-size: 18px;">\</p>\<p id="teacherRoom" style="margin: 0; font-size: 15px; color: #475569; font-weight: 500;">\</p>\<div class="teacher-menu-stack">\
  \<div class="teacher-menu-item" id="reportMenuItem">\
    \<button type="button" class="teacher-menu-toggle" data-menu-target="reportMenuPanel" aria-expanded="false" onclick="toggleTeacherMenu('reportMenuPanel')">📊 จัดการรายงาน <span class="teacher-menu-arrow">▼</span>\</button>\
    \<div id="reportMenuPanel" class="teacher-menu-panel" style="display:none;"><div id="adminActionArea">\</div>\</div>\
  \</div>\
  \<div class="teacher-menu-item" id="profileMenuItem">\
    \<button type="button" class="teacher-menu-toggle" data-menu-target="profileMenuPanel" aria-expanded="false" onclick="toggleTeacherMenu('profileMenuPanel')">🔐 เปลี่ยนชื่อและรหัสผ่าน <span class="teacher-menu-arrow">▼</span>\</button>\
    \<div id="profileMenuPanel" class="teacher-menu-panel" style="display:none;"><div id="teacherProfileArea"></div>\</div>\
  \</div>\
  \<div class="teacher-menu-item" id="adminMenuItem" style="display:none;">\
    \<button type="button" class="teacher-menu-toggle" data-menu-target="adminMenuPanel" aria-expanded="false" onclick="toggleTeacherMenu('adminMenuPanel')">⚙️ ผู้ดูแลระบบ (Admin) <span class="teacher-menu-arrow">▼</span>\</button>\
    \<div id="adminMenuPanel" class="teacher-menu-panel" style="display:none;"><div id="adminSettingsArea" style="display:none;">\</div>\</div>\
  \</div>\
\</div>\<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">\<h3 style="margin: 5px 0; font-size: 14px; color: #334155; font-weight: 600; text-align: left;">📊 ยอดรวมผลการเข้าแถว (คลิกเพื่อเลือกกรองรายชื่อ)\</h3>\<div class="summary-container">\<div class="summary-card sum-all selected" id="card-all" onclick="filterByStatus('ทั้งหมด')">นักเรียนทั้งหมด\<span id="count-all">0\</span>\</div>\<div class="summary-card sum-present" id="card-present" onclick="filterByStatus('มาแล้ว')">🟢 มาแล้ว\<span id="count-present">0\</span>\</div>\<div class="summary-card sum-late" id="card-late" onclick="filterByStatus('ขอมาสาย')">🟡 ขอมาสาย\<span id="count-late">0\</span>\</div>\<div class="summary-card sum-leave" id="card-leave" onclick="filterByStatus('ลา')">🔵 ลา\<span id="count-leave">0\</span>\</div>\<div class="summary-card sum-absent" id="card-absent" onclick="filterByStatus('ขาดเรียน')">🔴 ขาดเรียน\<span id="count-absent">0\</span>\</div>\<div class="summary-card sum-activity" id="card-activity" onclick="filterByStatus('กิจกรรม')">🟣 กิจกรรม\<span id="count-activity">0\</span>\</div>\<div class="summary-card sum-uncheck" id="card-uncheck" onclick="filterByStatus('ไม่ได้เช็ค')">⚪ ไม่ได้เช็ค\<span id="count-uncheck">0\</span>\</div>\</div>\<button type="button" class="status-btn" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); margin-bottom: 15px; font-weight:700; box-shadow: 0 4px 10px rgba(17,153,142,0.15);" id="autoCheckButton" onclick="autoCheckRemainingToPresent()">✅ เช็คชื่อที่เหลือเป็น "มาแล้ว" อัตโนมัติ\</button>\<div class="scroll-div">\<table class="report-table">\<thead>\<tr>\<th style="width: 8%;">ที่\</th>\<th style="width: 14%;">รหัส\</th>\<th style="width: 28%;">ชื่อ-นามสกุล\</th>\<th style="width: 50%;">Form\</th>\</tr>\</thead>\<tbody id="reportEntries">\</tbody>\</table>\</div>\<button class="status-btn" style="background: linear-gradient(135deg, #1f4068 0%, #162447 100%); margin-top: 20px; font-weight:700;" id="saveTeacherButton" onclick="submitAllTeacherData()">💾 บันทึกข้อมูลการเช็คชื่อทั้งหมด\</button>\<button class="status-btn" style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); margin-top: 12px; font-weight:700;" onclick="location.reload()">ออกจากระบบ\</button>\</div>\<div id="message">\</div>\</div>







  \<!-- Modal 1: แจ้งเตือนพื้นฐาน -->



  \<div id="reportModal" class="modal">\<div class="modal-content">\<span class="close-modal" onclick="closeModal()">&times;\</span>\<h3 id="modalTitle" style="margin-top: 5px; color: #1e3c72; font-weight: 700;">📋 รายงานสรุปพร้อมคัดลอก\</h3>\<p style="font-size: 13px; color: #64748b; margin: 0;">คุณครูสามารถตรวจสอบข้อความ และกดปุ่มคัดลอกเพื่อนำไปวางในกลุ่ม LINE ได้เลยครับ\</p>\<textarea id="reportTextarea" readonly>\</textarea>\<div class="copy-success-tip" id="copyTip">✅ คัดลอกข้อความลงคลิปบอร์ดเรียบร้อยแล้ว! สามารถนำไปวาง (Paste) ใน LINE ได้ทันที\</div>\<button class="submit-btn" style="margin-top:15px; background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);" onclick="copyModalText()">📋 คัดลอกข้อความ\</button>\</div>\</div>







  \<!-- Modal 2: แจ้งเตือนผู้ปกครอง (ระบบค้นหาช่วงวันที่) -->



  \<div id="customReportModal" class="modal">\<div class="modal-content">\<span class="close-modal" onclick="document.getElementById('customReportModal').style.display='none'">&times;\</span>\<h3 style="margin-top: 5px; color: #1e3c72; font-weight: 700;">📅 รายงานระบุช่วงเวลา\</h3>\<p style="font-size: 13px; color: #64748b; margin: 0 0 15px 0;">ดึงข้อมูลตามช่วงวันที่เลือก เพื่อสรุปแจ้งผู้ปกครอง\</p>\<div style="display:flex; gap:10px; margin-bottom:10px;">\<div style="flex:1;">\<label style="font-size:14px; font-weight:600;">ตั้งแต่วันที่:\</label>\<input type="date" id="customStartDate">\</div>\<div style="flex:1;">\<label style="font-size:14px; font-weight:600;">ถึงวันที่:\</label>\<input type="date" id="customEndDate">\</div>\</div>\<label style="font-size:14px; font-weight:600;">เลือกนักเรียน:\</label>\<select id="customStudentSelect">\</select>\<label style="font-size:14px; font-weight:600; display:block; margin-top:10px;">กรองสถานะที่ต้องการ:\</label>\<div style="display:flex; flex-wrap:wrap; gap:10px; margin: 10px 0; font-size:14px;">\<label>\<input type="checkbox" class="custom-status-chk" value="ขอมาสาย" checked> ขอมาสาย\</label>\<label>\<input type="checkbox" class="custom-status-chk" value="ลา" checked> ลา\</label>\<label>\<input type="checkbox" class="custom-status-chk" value="ขาดเรียน" checked> ขาดเรียน\</label>\<label>\<input type="checkbox" class="custom-status-chk" value="กิจกรรม" checked> กิจกรรม\</label>\<label>\<input type="checkbox" class="custom-status-chk" value="ไม่ได้เช็ค" checked> ไม่ได้เช็ค\</label>\</div>\<button class="submit-btn" style="background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); margin-top:10px;" onclick="fetchCustomReport()">🔍 ค้นหาข้อมูล\</button>\<textarea id="customReportResult" readonly style="display:none;">\</textarea>\<button id="customCopyBtn" class="submit-btn" style="display:none; margin-top:10px; background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);" onclick="copyCustomText()">📋 คัดลอกข้อความเพื่อส่ง LINE\</button>\</div>\</div>







  \<script>



  let currentRole = 'student';let sessionData = null;let masterRecords = [];let currentFilter = 'ทั้งหมด';



  window\.onload = function() { const today = new Date(); const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; document.getElementById('globalDateBadge').innerText = "📅 " + today.toLocaleDateString('th-TH', options); renderTeacherHistory(); document.getElementById('reportEntries').addEventListener('click', function(e) { if (e.target && e.target.classList.contains('badge-btn')) { clickBadgeByTeacher(e.target.closest('tr').getAttribute('data-student-id'), e.target.getAttribute('data-val'), e.target); } });};



  function setRole(role) { currentRole = role; document.getElementById('btnStudent').classList.toggle('active', role === 'student'); document.getElementById('btnTeacher').classList.toggle('active', role === 'teacher'); document.getElementById('loginId').placeholder = (role === 'student') ? "กรอกเลขประจำตัวนักเรียน 5 หลัก" : "กรอกรหัสผ่านเข้าสู่ระบบ"; document.getElementById('loginId').value = ""; document.getElementById('message').innerText = ""; renderTeacherHistory();}



  function renderTeacherHistory() { const datalist = document.getElementById('teacherHistory'); datalist.innerHTML = ""; if (currentRole === 'teacher') { let saved = localStorage.getItem("TEACHER_PASSWORDS"); if (saved) { JSON.parse(saved).forEach(pwd => { let opt = document.createElement('option'); opt.value = pwd; datalist.appendChild(opt); }); } }}



function handleLogin() {

    const idValue = document.getElementById('loginId').value.trim();

    if (!idValue) return alert('กรุณากรอกข้อมูล');

    const message = document.getElementById('message');

    message.innerText = 'กำลังตรวจสอบสิทธิ์...';

    message.style.color = '#334155';

    if (currentRole === 'student') {

      google.script.run.withSuccessHandler(function(student) {

        if (!student) {

          message.innerText = '❌ ไม่พบข้อมูลสิทธิ์เข้าใช้งาน';

          message.style.color = 'red';

          return;

        }

        sessionData = student;

        document.getElementById('studentName').innerText = 'สวัสดี: ' + student.name + ' (ห้อง ' + student.room + ')';

        document.getElementById('loginSection').style.display = 'none';

        document.getElementById('studentSection').style.display = 'block';

        message.innerText = '';

      }).withFailureHandler(function(err) {

        message.innerText = '❌ ' + (err && err.message ? err.message : err);

        message.style.color = 'red';

      }).verifyStudentId(idValue);

      return;

    }

    google.script.run.withSuccessHandler(function(teacher) {

      if (!teacher) {

        message.innerText = '❌ รหัสผ่านไม่ถูกต้อง';

        message.style.color = 'red';

        return;

      }

      sessionData = teacher;

      savePasswordToLocal(idValue);

      document.getElementById('teacherName').innerText = 'ยินดีต้อนรับ: ' + teacher.name;

      document.getElementById('teacherRoom').innerText = teacher.room ? 'คุณครูที่ปรึกษาห้อง: ' + teacher.room : 'ผู้ดูแลระบบระดับชั้น ม.2';
      renderTeacherProfileEditor(teacher);

      document.getElementById('loginSection').style.display = 'none';

      document.getElementById('teacherSection').style.display = 'block';

      google.script.run.withSuccessHandler(function(settings) {

        renderTeacherActions(teacher, settings || {});

        buildTeacherReport(teacher.room || '');

      }).withFailureHandler(function(err) {

        message.innerText = '❌ ไม่สามารถโหลดการตั้งค่าระบบได้: ' + (err && err.message ? err.message : err);

        message.style.color = 'red';

      }).getSystemSettingsForUI(teacher.sessionToken);

    }).withFailureHandler(function(err) {

      message.innerText = '❌ ' + (err && err.message ? err.message : err);

      message.style.color = 'red';

    }).verifyTeacherId(idValue);

  }





  function toggleTeacherMenu(panelId) {
    const menuIds = ['reportMenuPanel', 'profileMenuPanel', 'adminMenuPanel'];
    const target = document.getElementById(panelId);
    if (!target) return;
    const shouldOpen = target.style.display !== 'block';

    menuIds.forEach(function(id) {
      const panel = document.getElementById(id);
      if (panel) panel.style.display = 'none';
      const button = document.querySelector('[data-menu-target="' + id + '"]');
      if (button) {
        button.setAttribute('aria-expanded', 'false');
        const arrow = button.querySelector('.teacher-menu-arrow');
        if (arrow) arrow.textContent = '▼';
      }
    });

    if (shouldOpen) {
      target.style.display = 'block';
      const button = document.querySelector('[data-menu-target="' + panelId + '"]');
      if (button) {
        button.setAttribute('aria-expanded', 'true');
        const arrow = button.querySelector('.teacher-menu-arrow');
        if (arrow) arrow.textContent = '▲';
      }
    }
  }

  function renderTeacherActions(teacher, settings) {

    const area = document.getElementById('adminActionArea');

    const settingsArea = document.getElementById('adminSettingsArea');
    const adminMenuItem = document.getElementById('adminMenuItem');
    if (adminMenuItem) {
      adminMenuItem.style.display = teacher.isAdmin ? 'block' : 'none';
      if (!teacher.isAdmin) {
        const adminPanel = document.getElementById('adminMenuPanel');
        if (adminPanel) adminPanel.style.display = 'none';
      }
    }

    let html = '<div class="admin-btn-group">';

    if (teacher.isAdmin && settings.lateReport !== false) {

      html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#f39c12 0%,#e67e22 100%);font-weight:700;" onclick="openLateReportModal()">🟡 ปุ่มที่ 1: รายงานคนสาย (รวมทั้ง ม.2)\</button>';

      if (settings.emailNotifications !== false) html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#e67e22 0%,#c0392b 100%);font-weight:700;" onclick="sendLateReportEmail()">✉️ ส่งรายงานคนสายไปยัง E-mail Admin\</button>';

    }

    if (teacher.isAdmin && settings.absentLeaveReport !== false) {

      html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#e74c3c 0%,#c0392b 100%);font-weight:700;" onclick="openAbsentLeaveModal()">📊 ปุ่มที่ 2: รายงานคนขาด/ลา (รวมทั้ง ม.2)\</button>';

    }

    if (teacher.isAdmin && settings.dailyExceptionEmailReport !== false && settings.emailNotifications !== false) {

      html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#6c5ce7 0%,#4834d4 100%);font-weight:700;" onclick="sendDailyExceptionsEmail()">📧 ส่งรายงานคนลา / ขาดเรียน / กิจกรรม ไปยัง E-mail Admin\</button>';

    }

    if (teacher.room && settings.roomReport !== false) {

      html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#3498db 0%,#2980b9 100%);font-weight:700;" onclick="openDynamicRoomModal()">👨‍👩‍👦 สรุปยอดเช็คชื่อ (กลุ่มผู้ปกครองห้อง ' + escapeClientHtml(teacher.room) + ' ประจำวัน)\</button>';

    }

    if (teacher.room && settings.customParentReport !== false) {

      html += '\<button type="button" class="status-btn" style="background:linear-gradient(135deg,#8e44ad 0%,#9b59b6 100%);font-weight:700;" onclick="openCustomReportModal()">📅 ค้นหารายงานช่วงเวลา/รายบุคคล (ส่งผู้ปกครอง)\</button>';

    }

    html += '\</div>';

    area.innerHTML = html;

    if (teacher.isAdmin) {

      settingsArea.style.display = 'block';

      renderAdminSettings(settings);

    } else {

      settingsArea.style.display = 'none';

      settingsArea.innerHTML = '';

    }

    const canTeacherSave = settings.teacherAttendance !== false;

    document.getElementById('autoCheckButton').style.display = canTeacherSave ? 'block' : 'none';

    document.getElementById('saveTeacherButton').style.display = canTeacherSave ? 'block' : 'none';

    if (!canTeacherSave) {

      document.getElementById('message').innerText = '⚠️ แอดมินปิดระบบเช็คชื่อ/บันทึกข้อมูลโดยครูอยู่ ขณะนี้ดูข้อมูลได้อย่างเดียว';

      document.getElementById('message').style.color = '#b45309';

    }

  }



  function renderTeacherProfileEditor(teacher) {
    const area = document.getElementById('teacherProfileArea');
    if (!area) return;
    area.innerHTML = '\<div class="teacher-profile-panel">' +
      '\<h3>👤 ข้อมูลบัญชีครู</h3>' +
      '\<p class="profile-help">แก้ไขชื่อที่ใช้แสดงและรหัสผ่านของบัญชีตนเองได้ โดยไม่กระทบสิทธิ์ ห้องที่ปรึกษา หรืออีเมล</p>' +
      '\<div id="teacherProfileForm" class="teacher-profile-form" style="display:block;">' +
      '\<label for="profileCurrentPassword">รหัสผ่านปัจจุบัน (ใช้ยืนยันตัวตน)</label>' +
      '\<input type="password" id="profileCurrentPassword" autocomplete="current-password" placeholder="กรอกรหัสผ่านปัจจุบัน">' +
      '\<label for="profileNewName">ชื่อครูที่ต้องการแสดง</label>' +
      '\<input type="text" id="profileNewName" maxlength="100" autocomplete="name" placeholder="กรอกชื่อ-นามสกุล">' +
      '\<label for="profileNewPassword">รหัสผ่านใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)</label>' +
      '\<input type="password" id="profileNewPassword" minlength="4" maxlength="64" autocomplete="new-password" placeholder="กำหนดรหัสผ่านใหม่อย่างน้อย 4 ตัวอักษร">' +
      '\<label for="profileConfirmPassword">ยืนยันรหัสผ่านใหม่</label>' +
      '\<input type="password" id="profileConfirmPassword" minlength="4" maxlength="64" autocomplete="new-password" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง">' +
      '\<p class="profile-help">หากเปลี่ยนเฉพาะชื่อ ให้เว้นช่องรหัสผ่านใหม่ทั้งสองช่องไว้ ระบบจะคงรหัสผ่านเดิม</p>' +
      '\<button type="button" class="submit-btn" style="margin-top:8px;background:linear-gradient(135deg,#11998e 0%,#0f766e 100%);" onclick="saveTeacherOwnProfile()">💾 บันทึกข้อมูลบัญชี</button>' +
      '\</div></div>';
    const nameInput = document.getElementById('profileNewName');
    if (nameInput) nameInput.value = teacher.name || '';
  }


  function toggleTeacherProfileForm() {
    const form = document.getElementById('teacherProfileForm');
    if (!form) return;
    const opening = form.style.display !== 'block';
    form.style.display = opening ? 'block' : 'none';
    if (opening) {
      const current = document.getElementById('profileCurrentPassword');
      if (current) current.focus();
    }
  }

  function replaceSavedTeacherPassword(oldPassword, newPassword) {
    const key = 'TEACHER_PASSWORDS';
    let saved = localStorage.getItem(key);
    let list = [];
    try { list = saved ? JSON.parse(saved) : []; } catch (err) { list = []; }
    list = Array.isArray(list) ? list : [];
    const oldValue = String(oldPassword || '');
    const newValue = String(newPassword || '');
    list = list.filter(value => String(value) !== oldValue && String(value) !== newValue);
    if (newValue) list.unshift(newValue);
    if (list.length > 5) list = list.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(list));
    renderTeacherHistory();
  }

  function saveTeacherOwnProfile() {
    if (!sessionData || !sessionData.sessionToken) return alert('กรุณาเข้าสู่ระบบครูใหม่อีกครั้ง');

    const currentPassword = document.getElementById('profileCurrentPassword').value.trim();
    const newName = document.getElementById('profileNewName').value.trim();
    const newPassword = document.getElementById('profileNewPassword').value.trim();
    const confirmPassword = document.getElementById('profileConfirmPassword').value.trim();
    if (!currentPassword) return alert('กรุณากรอกรหัสผ่านปัจจุบัน');
    if (!newName) return alert('กรุณากรอกชื่อครู');
    if (newPassword && newPassword.length < 4) return alert('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร');
    if (newPassword !== confirmPassword) return alert('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');

    const oldPassword = currentPassword;
    const message = document.getElementById('message');
    message.innerText = 'กำลังบันทึกข้อมูลบัญชีครู...';
    message.style.color = '#334155';

    google.script.run.withSuccessHandler(function(result) {
      if (!result || !result.success || !result.teacher) {
        message.innerText = result && result.message ? result.message : '❌ ไม่สามารถบันทึกข้อมูลบัญชีได้';
        message.style.color = 'red';
        return;
      }

      sessionData = result.teacher;
      replaceSavedTeacherPassword(oldPassword, newPassword || oldPassword);
      document.getElementById('teacherName').innerText = 'ยินดีต้อนรับ: ' + sessionData.name;
      document.getElementById('teacherRoom').innerText = sessionData.room ? 'คุณครูที่ปรึกษาห้อง: ' + sessionData.room : 'ผู้ดูแลระบบระดับชั้น ม.2';
      renderTeacherProfileEditor(sessionData);
      message.innerText = '✅ ' + result.message;
      message.style.color = 'green';
      buildTeacherReport(sessionData.room || '');
    }).withFailureHandler(function(err) {
      message.innerText = '❌ ไม่สามารถบันทึกข้อมูลบัญชีได้: ' + (err && err.message ? err.message : err);
      message.style.color = 'red';
    }).updateTeacherOwnProfile(sessionData.sessionToken, currentPassword, newName, newPassword, confirmPassword);
  }


  function escapeClientHtml(value) {

    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {

      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);

    });

  }



  function renderAdminSettings(settings) {

    const labels = {

      studentLogin: 'เปิด/ปิดการเข้าสู่ระบบของนักเรียน',

      teacherLogin: 'เปิด/ปิดการเข้าสู่ระบบของครู (แอดมินยังเข้าสู่ระบบได้)',

      studentSelfCheck: 'เปิด/ปิดการบันทึกเช็คชื่อด้วยตนเองของนักเรียน',

      teacherAttendance: 'เปิด/ปิดการเช็คชื่อและบันทึกข้อมูลโดยครู',

      lateReport: 'เปิด/ปิดรายงานนักเรียนขอมาสายระดับชั้น ม.2',

      absentLeaveReport: 'เปิด/ปิดรายงานนักเรียนขาด/ลาระดับชั้น ม.2',

      roomReport: 'เปิด/ปิดรายงานสรุปการเช็คชื่อรายห้อง',

      customParentReport: 'เปิด/ปิดรายงานย้อนหลังตามช่วงเวลา/รายบุคคล',

      emailNotifications: 'เปิด/ปิดการส่งสรุปข้อมูลทาง E-mail ถึงครูและนักเรียน',

      dailyExceptionEmailReport: 'เปิด/ปิดปุ่มส่งรายงานคนลา ขาดเรียน และกิจกรรมไปยัง E-mail Admin'

    };

    let html = '\<div class="admin-settings">\<h3>⚙️ แผงควบคุมผู้ดูแลระบบ (Admin)\</h3>';

    html += '\<p style="font-size:12px;color:#64748b;margin:0 0 8px;">การตั้งค่ามีผลกับผู้ใช้งานทุกคน และบันทึกไว้ในระบบ\</p>';

    Object.keys(labels).forEach(function(key) {

      const checked = settings[key] !== false ? ' checked' : '';

      const state = settings[key] !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

      html += '\<label class="setting-row">\<input type="checkbox" class="system-setting" data-setting="' + key + '"' + checked + '>\<span>' + labels[key] + '\</span>\<span class="setting-state">' + state + '\</span>\</label>';

    });

    html += '\<button type="button" class="submit-btn" style="margin-top:14px;background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);" onclick="saveAdminSettings()">💾 บันทึกการตั้งค่าระบบ\</button>\</div>';

    document.getElementById('adminSettingsArea').innerHTML = html;

    document.querySelectorAll('.system-setting').forEach(function(input) {

      input.addEventListener('change', function() {

        const stateLabel = input.parentElement.querySelector('.setting-state');

        stateLabel.innerText = input.checked ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

      });

    });

  }



  function saveAdminSettings() {

    if (!sessionData || !sessionData.isAdmin) return alert('ไม่มีสิทธิ์ปรับการตั้งค่าระบบ');

    const settings = {};

    document.querySelectorAll('.system-setting').forEach(function(input) {

      settings[input.getAttribute('data-setting')] = input.checked;

    });

    const message = document.getElementById('message');

    message.innerText = 'กำลังบันทึกการตั้งค่าระบบ...';

    google.script.run.withSuccessHandler(function(result) {

      message.innerText = result.message || 'บันทึกการตั้งค่าเรียบร้อยแล้ว';

      message.style.color = result.success ? 'green' : 'red';

      if (result.success) renderTeacherActions(sessionData, result.settings);

    }).withFailureHandler(function(err) {

      message.innerText = '❌ บันทึกการตั้งค่าไม่สำเร็จ: ' + (err && err.message ? err.message : err);

      message.style.color = 'red';

    }).saveSystemSettings(sessionData.sessionToken, settings);

  }



  function autoResizeTextarea(elementId) { const textarea = document.getElementById(elementId); textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px';}



  function sendDailyExceptionsEmail() {

    if (!sessionData || !sessionData.sessionToken || !sessionData.isAdmin) {
      return alert('เฉพาะ Admin เท่านั้นที่ส่งรายงานนี้ได้');
    }

    if (!confirm('ยืนยันส่งรายงานนักเรียนที่ลา ขาดเรียน และกิจกรรม ประจำวันนี้ ไปยัง E-mail ของ Admin ทุกคนหรือไม่?')) return;

    const message = document.getElementById('message');
    message.innerText = '⌛ กำลังจัดทำรายงานและส่ง E-mail ให้ Admin ทุกคน...';
    message.style.color = '#334155';

    google.script.run
      .withSuccessHandler(function(result) {
        if (!result) {
          message.innerText = '❌ ไม่ได้รับผลการส่งอีเมลจากเซิร์ฟเวอร์';
          message.style.color = 'red';
          return;
        }
        message.innerText = result.message || 'ดำเนินการส่งรายงานแล้ว';
        message.style.color = result.success ? 'green' : 'red';
        if (result.sentCount > 0) alert(result.message || ('ส่งอีเมลสำเร็จ ' + result.sentCount + ' บัญชี'));
      })
      .withFailureHandler(function(err) {
        message.innerText = '❌ ส่งรายงานไม่สำเร็จ: ' + (err && err.message ? err.message : err);
        message.style.color = 'red';
      })
      .sendDailyExceptionsEmailToAdmins(sessionData.sessionToken);
  }

  function sendLateReportEmail() {



    if (!sessionData || !sessionData.id) return alert('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');



    if (!confirm('ยืนยันส่งรายงานนักเรียนขอมาสายระดับชั้น ม.2 ไปยังอีเมลของ Admin ทุกคนหรือไม่?')) return;



    const message = document.getElementById('message');



    message.innerText = '⌛ กำลังจัดทำรายงานและส่ง E-mail ให้ Admin ทุกคน...';



    message.style.color = '#334155';



    google.script.run



      .withSuccessHandler(function(result) {



        if (!result) {



          message.innerText = '❌ ไม่ได้รับผลการส่งอีเมลจากเซิร์ฟเวอร์';



          message.style.color = 'red';



          return;



        }



        message.innerText = result.message || 'ดำเนินการส่งอีเมลแล้ว';



        message.style.color = result.success ? 'green' : 'red';



        if (result.sentCount > 0) {



          alert(result.message || ('ส่งอีเมลสำเร็จ ' + result.sentCount + ' บัญชี'));



        }



      })



      .withFailureHandler(function(err) {



        message.innerText = '❌ ส่งอีเมลไม่สำเร็จ: ' + (err && err.message ? err.message : err);



        message.style.color = 'red';



      })



      .sendLateReportEmailToAdmins(sessionData.sessionToken);



  }











  function openLateReportModal() { document.getElementById('message').innerText = "⌛ กำลังดึงรายงานข้อมูลคนสาย..."; document.getElementById('message').style.color = "#333"; google.script.run.withSuccessHandler(function(reportText) { if(reportText.startsWith("❌")) { document.getElementById('message').innerText = reportText; document.getElementById('message').style.color = "red"; return; } document.getElementById('modalTitle').innerText = "🟡 รายงานนักเรียนมาสาย ม.2"; document.getElementById('reportTextarea').value = reportText; document.getElementById('copyTip').style.display = "none"; document.getElementById('reportModal').style.display = "block"; document.getElementById('message').innerText = ""; autoResizeTextarea('reportTextarea'); }).withFailureHandler(function(err) { document.getElementById('message').innerText = "❌ ดึงข้อมูลล้มเหลว: " + err.message; document.getElementById('message').style.color = "red"; }).generateLateReportData(sessionData.sessionToken);}



  function openAbsentLeaveModal() { document.getElementById('message').innerText = "⌛ กำลังดึงรายงานข้อมูลคนขาด/ลา..."; document.getElementById('message').style.color = "#333"; google.script.run.withSuccessHandler(function(reportText) { if(reportText.startsWith("❌")) { document.getElementById('message').innerText = reportText; document.getElementById('message').style.color = "red"; return; } document.getElementById('modalTitle').innerText = "📊 รายงานนักเรียน ขาด-ลา ม.2"; document.getElementById('reportTextarea').value = reportText; document.getElementById('copyTip').style.display = "none"; document.getElementById('reportModal').style.display = "block"; document.getElementById('message').innerText = ""; autoResizeTextarea('reportTextarea'); }).withFailureHandler(function(err) { document.getElementById('message').innerText = "❌ ดึงข้อมูลล้มเหลว: " + err.message; document.getElementById('message').style.color = "red"; }).generateAbsentLeaveReportData(sessionData.sessionToken);}



  function openDynamicRoomModal() { let title = "👨‍👩‍👦 สรุปยอดเช็คชื่อเข้าแถว ห้อง " + sessionData.room + " (กลุ่มผู้ปกครอง)"; let header = "👨‍👩‍👦 เรียน ท่านผู้ปกครองนักเรียนห้อง " + sessionData.room + "\\\nขอแจ้งสถานะการเข้าแถวประจำวันเพื่อร่วมกันติดตามบุตรหลานครับ"; document.getElementById('message').innerText = "⌛ กำลังดึงรายงานห้อง " + sessionData.room + "..."; google.script.run.withSuccessHandler(function(reportText) { document.getElementById('modalTitle').innerText = title; document.getElementById('reportTextarea').value = reportText; document.getElementById('copyTip').style.display = "none"; document.getElementById('reportModal').style.display = "block"; document.getElementById('message').innerText = ""; autoResizeTextarea('reportTextarea'); }).withFailureHandler(function(err) { document.getElementById('message').innerText = "❌ ข้อผิดพลาด: " + err.message; }).generateRoomDynamicReportData(sessionData.room, header, sessionData.sessionToken);}



  function closeModal() { document.getElementById('reportModal').style.display = "none";}



  function copyModalText() { const textarea = document.getElementById('reportTextarea'); textarea.select(); textarea.setSelectionRange(0, 99999); try { document.execCommand('copy'); const tip = document.getElementById('copyTip'); tip.style.display = "block"; setTimeout(() => { tip.style.display = "none"; }, 3500); } catch (err) { alert("ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาครอบดำแล้วกดคัดลอกด้วยตัวเองครับ"); }}



  function openCustomReportModal() {



    let select = document.getElementById('customStudentSelect');



    select.innerHTML = '\<option value="all">👥 ทั้งห้อง (ทุกรายชื่อ)\</option>';



    masterRecords.forEach(r => { select.innerHTML += '\<option value="'+r.id+'">'+r.name+'\</option>'; });



    let tzOffset = (new Date()).getTimezoneOffset() \* 60000;



    let localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];



    document.getElementById('customStartDate').value = localISOTime;



    document.getElementById('customEndDate').value = localISOTime;



    document.getElementById('customReportResult').style.display = 'none';



    document.getElementById('customCopyBtn').style.display = 'none';



    document.getElementById('customReportModal').style.display = 'block';



  }



  function fetchCustomReport() {



    let sd = document.getElementById('customStartDate').value;



    let ed = document.getElementById('customEndDate').value;



    let student = document.getElementById('customStudentSelect').value;



    let chks = document.querySelectorAll('.custom-status-chk:checked');



    let statuses = Array.from(chks).map(c => c.value);



    if(!sd || !ed) return alert("กรุณาเลือกช่วงวันที่ให้ครบถ้วน");



    if(statuses.length === 0) return alert("กรุณาเลือกอย่างน้อย 1 สถานะครับ");



    document.getElementById('customReportResult').value = "⌛ กำลังค้นหาและรวบรวมข้อมูล...";



    document.getElementById('customReportResult').style.display = "block";



    google.script.run.withSuccessHandler(res => {



       document.getElementById('customReportResult').value = res;



       document.getElementById('customCopyBtn').style.display = "block";



       autoResizeTextarea('customReportResult');



    }).withFailureHandler(err => {



       document.getElementById('customReportResult').value = "❌ เกิดข้อผิดพลาด: " + err.message;



    }).generateCustomParentReport(sessionData.room, sd, ed, student, statuses, sessionData.sessionToken);



  }



  function copyCustomText() {



    const textarea = document.getElementById('customReportResult');



    textarea.select(); textarea.setSelectionRange(0, 99999);



    try { document.execCommand('copy'); alert('✅ คัดลอกสำเร็จ นำไปวางใน LINE ได้เลยครับ'); } catch (err) { alert("คัดลอกไม่ได้ กรุณาทำด้วยตัวเองครับ"); }



  }



  function savePasswordToLocal(pwd) { let saved = localStorage.getItem("TEACHER_PASSWORDS"); let arr = saved ? JSON.parse(saved) : []; if (!arr.includes(pwd)) { arr.unshift(pwd); if(arr.length > 5) arr.pop(); localStorage.setItem("TEACHER_PASSWORDS", JSON.stringify(arr)); }}



  function toggleReason() { document.getElementById('reason').style.display = (document.getElementById('status').value === 'มาแล้ว') ? 'none' : 'block';}



  function submitStudentData() { document.getElementById('message').innerText = "กำลังบันทึกข้อมูล..."; document.getElementById('message').style.color = "#1e293b"; google.script.run.withSuccessHandler(res => { document.getElementById('message').innerText = res; if(res.includes("สำเร็จ")) { document.getElementById('message').style.color = "green"; setTimeout(() => location.reload(), 2000); } else { document.getElementById('message').style.color = "red"; } }).saveWebData(sessionData.sessionToken, document.getElementById('status').value, document.getElementById('reason').value); }



  function buildTeacherReport(roomNumber) { google.script.run.withSuccessHandler(records => { masterRecords = records; updateDashboardCounters(); renderTableRows(); document.getElementById('loginSection').style.display = 'none'; document.getElementById('teacherSection').style.display = 'block'; document.getElementById('message').innerText = ""; }).getTeacherReportData(roomNumber, sessionData.sessionToken);}



  function updateDashboardCounters() { document.getElementById('count-all').innerText = masterRecords.length; document.getElementById('count-present').innerText = masterRecords.filter(r => r.status === 'มาแล้ว').length; document.getElementById('count-late').innerText = masterRecords.filter(r => r.status === 'ขอมาสาย').length; document.getElementById('count-leave').innerText = masterRecords.filter(r => r.status === 'ลา').length; document.getElementById('count-absent').innerText = masterRecords.filter(r => r.status === 'ขาดเรียน').length; document.getElementById('count-activity').innerText = masterRecords.filter(r => r.status === 'กิจกรรม').length; document.getElementById('count-uncheck').innerText = masterRecords.filter(r => r.status === 'ไม่ได้เช็ค').length;}



  function filterByStatus(statusType) { currentFilter = statusType; document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('selected')); const idMap = {'ทั้งหมด':'card-all','มาแล้ว':'card-present','ขอมาสาย':'card-late','ลา':'card-leave','ขาดเรียน':'card-absent','กิจกรรม':'card-activity','ไม่ได้เช็ค':'card-uncheck'}; if(idMap[statusType]) document.getElementById(idMap[statusType]).classList.add('selected'); renderTableRows();}



  function renderTableRows() { const tbody = document.getElementById('reportEntries'); tbody.innerHTML = ""; let filtered = (currentFilter === 'ทั้งหมด') ? masterRecords : masterRecords.filter(r => r.status === currentFilter); filtered.forEach(row => { let tr = document.createElement('tr'); tr.setAttribute('data-student-id', row\.id); let options = ["มาแล้ว", "ขอมาสาย", "ลา", "ขาดเรียน", "กิจกรรม", "ไม่ได้เช็ค"]; let badgesHtml = '\<div class="badge-group">'; options.forEach(opt => { let displayOpt = opt; let isSelected = (row\.status === opt) ? "active" : ""; badgesHtml += '\<button type="button" class="badge-btn ' + isSelected + '" data-val="' + opt + '">' + displayOpt + '\</button>'; }); badgesHtml += '\</div>'; if(row\.reason) badgesHtml += '\<div style="color:#e67e22; font-size:12px; margin-top:4px; font-weight:500;">⚠️ เหตุผล: ' + row\.reason + '\</div>'; tr.innerHTML = '\<td style="text-align:center; font-weight:600; color:#475569;">'+row\.no+'\</td>\<td style="text-align:center; color:#64748b;">'+row\.id+'\</td>\<td style="font-weight:500; color:#1e293b;">'+row\.name+'\</td>\<td>'+badgesHtml+'\</td>'; tbody.appendChild(tr); });}



  function clickBadgeByTeacher(studentId, selectedStatus, btnElement) { let target = masterRecords.find(r => r.id.toString() === studentId.toString()); if(target) { target.status = selectedStatus; if(selectedStatus === "มาแล้ว") target.reason = ""; updateDashboardCounters(); } btnElement.parentElement.querySelectorAll('.badge-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active');}



  function autoCheckRemainingToPresent() { let changedCount = 0; masterRecords.forEach(row => { if (row\.status === "ไม่ได้เช็ค" || row\.status === "") { row\.status = "มาแล้ว"; row\.reason = ""; changedCount++; } }); if (changedCount === 0) { alert("ไม่มีนักเรียนที่มีสถานะ 'ไม่ได้เช็ค' แล้วค่ะ"); return; } updateDashboardCounters(); renderTableRows(); document.getElementById('message').innerText = "💡 ปรับเปลี่ยนสถานะคนที่เหลือเป็น 'มาแล้ว' ชั่วคราวเรียบร้อย (กรุณากดปุ่มบันทึกข้อมูลด้านล่างเพื่อยืนยันลงเบส)"; document.getElementById('message').style.color = "#1e3c72";}



  function submitAllTeacherData() { if(!confirm("บันทึกข้อมูลทั้งหมดใช่ไหม?")) return; google.script.run.withSuccessHandler(res => { document.getElementById('message').innerText = res; if(res.includes("สำเร็จ")) setTimeout(() => buildTeacherReport(sessionData.room), 1500); }).updateBulkStatusByTeacher(JSON.stringify(masterRecords), sessionData.sessionToken);}



  \</script>\</body>\</html>`;



}




