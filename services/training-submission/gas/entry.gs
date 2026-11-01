// Only these three public functions are callable by web clients.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Reviewer').setTitle('연수 제출 확인함');
}
function doPost(e) {
  var request;
  try {
    if (!e || !e.postData || e.postData.contents.length > 7500000) throw new Error('size');
    request = JSON.parse(e.postData.contents);
  } catch (_) { return json_({ok:false,data:null,error:{code:'VALIDATION',message:'요청 형식을 확인해 주세요.'},requestId:null}); }
  return json_(trainingRequest(request));
}
function trainingRequest(request) {
  try { return application_()(request); }
  catch (_) { return {ok:false,data:null,error:{code:'STORAGE_ERROR',message:'서버 설정과 저장소 접근 권한을 확인해 주세요.'},requestId:null}; }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function properties_() { return PropertiesService.getScriptProperties(); }
function assertPrivate_(item) {
  if (item.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Storage must have restricted general access');
}
function environment_() {
  var props = properties_();
  if (props.getProperty('PRIVATE_FOLDER_CONFIRMED') !== 'true') throw new Error('Private storage not confirmed');
  var email = props.getProperty('DEPLOYER_EMAIL');
  if (!email || Session.getEffectiveUser().getEmail().toLowerCase() !== email.toLowerCase()) throw new Error('Wrong deployer');
  var parent = DriveApp.getFolderById(props.getProperty('PARENT_FOLDER_ID'));
  assertPrivate_(parent);
  if (!parent.getOwner() || parent.getOwner().getEmail().toLowerCase() !== email.toLowerCase()) throw new Error('Parent must be owned by deployer');
  return {props:props,parent:parent};
}
function application_() {
  var config = environment_();
  var sheetId = config.props.getProperty('SPREADSHEET_ID');
  var folder = DriveApp.getFolderById(config.props.getProperty('EVIDENCE_FOLDER_ID'));
  assertPrivate_(folder); assertPrivate_(DriveApp.getFileById(sheetId));
  var book = SpreadsheetApp.openById(sheetId);
  var actors = function() { return JSON.parse(book.getSheetByName('DEMO_ACTOR').getRange('A2').getValue()); };
  var catalog = JSON.parse(book.getSheetByName('CATALOG').getRange('A2').getValue());
  var clock = function() { return new Date().toISOString(); };
  var authenticate = TrainingModule_.createTokenAuthenticator({hash:hash_,clock:clock,actors:actors,credentials:function() { return JSON.parse(config.props.getProperty('TRAINING_AUTH_JSON') || '[]'); }});
  var service = TrainingModule_.createTrainingService({
    repository:TrainingModule_.createSheetRepository(book.getSheetByName('SUBMISSION'),function() { SpreadsheetApp.flush(); }),
    evidenceStore:TrainingModule_.createDriveEvidenceStore({Utilities:Utilities,DriveApp:DriveApp},folder),
    clock:clock,idGenerator:function() { return Utilities.getUuid(); },hash:hash_,
    decodeBase64:function(value) { return Utilities.base64Decode(value); },catalog:catalog
  });
  return TrainingModule_.createApplication({authenticate:authenticate,service:service,withLock:function(fn) {
    var lock=LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw Object.assign(new Error('busy'),{code:'BUSY'});
    try { return fn(); } finally { lock.releaseLock(); }
  }});
}

// Run only from the Apps Script editor. Trailing '_' prevents google.script.run access.
// Configure Script Properties first; never paste credentials into this source.
function setupDemo_() {
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var config=environment_(); var props=config.props;
    var sheetId=props.getProperty('SPREADSHEET_ID');
    if (!sheetId) {
      var created=SpreadsheetApp.create('Training submission demo');
      sheetId=created.getId(); props.setProperty('SPREADSHEET_ID',sheetId);
    }
    var sheetFile=DriveApp.getFileById(sheetId); assertPrivate_(sheetFile); sheetFile.moveTo(config.parent);
    var book=SpreadsheetApp.openById(sheetId);
    var folderId=props.getProperty('EVIDENCE_FOLDER_ID');
    if (!folderId) { folderId=config.parent.createFolder('Training evidence demo').getId(); props.setProperty('EVIDENCE_FOLDER_ID',folderId); }
    assertPrivate_(DriveApp.getFolderById(folderId));
    var actorSheet=book.getSheetByName('DEMO_ACTOR') || book.insertSheet('DEMO_ACTOR');
    var catalogSheet=book.getSheetByName('CATALOG') || book.insertSheet('CATALOG');
    var submissionSheet=book.getSheetByName('SUBMISSION') || book.insertSheet('SUBMISSION');
    if (!actorSheet.getRange('A2').getValue()) actorSheet.getRange('A1:A2').setValues([['actors JSON'],[JSON.stringify([{actorId:'teacher-a',role:'teacher'},{actorId:'teacher-b',role:'teacher'},{actorId:'reviewer-a',role:'reviewer'}])]]);
    if (!catalogSheet.getRange('A2').getValue()) catalogSheet.getRange('A1:A2').setValues([['catalog JSON'],[JSON.stringify(TrainingModule_.DEMO_CATALOG)]]);
    if (!submissionSheet.getRange('A1').getValue()) submissionSheet.getRange('A1:B1').setValues([['submissionId','JSON chunks (j: prefix)']]);
    SpreadsheetApp.flush();
    return '시연 저장소를 준비했습니다. 인증값 검증 정보는 스크립트 속성에서 별도로 설정하세요.';
  } finally { lock.releaseLock(); }
}

// Optional cleanup: only unreferenced deterministic evidence older than 24 hours.
// Run with no active uploads; setup/private-account guards and script lock still apply.
function cleanupOrphanEvidence_() {
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var config=environment_();
    var sheet=SpreadsheetApp.openById(config.props.getProperty('SPREADSHEET_ID')).getSheetByName('SUBMISSION');
    var records=TrainingModule_.createSheetRepository(sheet,function(){}).list();
    var used={}; records.forEach(function(r) { used[r.evidence.id]=true; (r.evidenceHistory || []).forEach(function(id) { used[id]=true; }); });
    var folder=DriveApp.getFolderById(config.props.getProperty('EVIDENCE_FOLDER_ID')); assertPrivate_(folder);
    var files=folder.getFiles(); var count=0;
    while(files.hasNext()) { var file=files.next(); if (!used[file.getId()] && /^training-[a-f0-9]+\.pdf$/.test(file.getName()) && Date.now()-file.getDateCreated().getTime()>86400000) { file.setTrashed(true); count++; } }
    return count;
  } finally { lock.releaseLock(); }
}
