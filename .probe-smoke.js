var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
// 冒烟：确认所有本应存在的函数都还在（防止搬移代码时丢函数）
var fns=['initApp','addedAtToDate','findTrackedSource','resolveApplyDate','fixAppliedDates',
 'getProvinceForCity','exploreRowHtml','updateExploreRowsFor','refreshAfterJobChange','refreshAfterJobListChange',
 'renderTrackView','renderTrackStats','renderExplore','renderTrack','renderBoard','renderList','renderStarMap',
 'stopStarMap','setTrackView','addToTrack','handleDrop','saveJob','deleteJob','changeStatus',
 'getTrackedStarJobIds','getTrackJobsByCompany','loadJobList','saveJobList','loadJobs','saveJobs',
 'loadReviews','saveReviews','loadResumeData','saveResumeData','renderReviews','renderResume',
 'exportData','importData','buildBackup','syncQiuzhiFangzhou','qzTransformJobs','mergeQiuzhiList',
 'sanitizeJob','sanitizeReview','sanitizeJobList','safeHref','safeId','safeDataUrl','escapeHtml',
 'renderPdfStatus','handlePdfUpload','exportRightWord','deleteReview'];
var missing=[];
fns.forEach(function(n){ if(typeof window[n]!=='function') missing.push(n); });
chk('所有关键函数均存在（'+fns.length+' 个）', missing.length===0, missing.join(','));

// initApp 是否真的跑过（初始渲染是否完成）
chk('岗位清单表格已渲染', !!document.getElementById('exploreGrid'));
chk('统计卡已渲染', !!document.querySelector('#exploreStats .stat-card'));
chk('投递管理统计已渲染', !!document.querySelector('#trackStats .stat-card'));
chk('简历附件区已渲染', !!document.getElementById('resumePdfSection'));
chk('岗位清单页签计数存在', !!document.getElementById('exploreCount'));
// PROVINCE_MAP 内共有 90 个城市条目，阈值按实际值设定\nchk('省份索引已构建（90 条）', typeof CITY_TO_PROVINCE === 'object' && Object.keys(CITY_TO_PROVINCE).length === 90, Object.keys(CITY_TO_PROVINCE||{}).length);
chk('省份查表正确（深圳→广东）', getProvinceForCity('深圳')==='广东', getProvinceForCity('深圳'));
chk('省份查表正确（上海→上海）', getProvinceForCity('上海')==='上海', getProvinceForCity('上海'));
chk('未收录城市返回 null', getProvinceForCity('不存在的城市')===null);
return R;
