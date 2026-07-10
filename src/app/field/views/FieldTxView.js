'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  unique, calcTxMetrics, txRowToApi, savedTxToForm, fmtDate, normalizeDateText, same,
  matchSavedTxRecord, resolveTxClientPeriod, normalizeTxId,
  resolveAssessor, ASSESSOR_REQUIRED_MSG, buildTxConcurrenceRows,
} from '@/lib/dqa-entry'
import {
  EMPTY_MISMATCH_RESOLUTION,
  isResolutionComplete,
  normalizeResolutionMap,
} from '@/lib/mismatch-resolution'
import { resolveRegimenLineSelectValue, resolveRegimenSelectValue } from '@/lib/regimen-list'
import { resolveTbStatusSelectValue } from '@/lib/tb-status-list'
import { resolvePregnancyStatusSelectValue } from '@/lib/pregnancy-status-list'
import { useFieldEntry } from '../FieldEntryContext'
import SuspenseSection from '../SuspenseSection'
import FieldSectionSkeleton from '../FieldSectionSkeleton'
import TxClientSearchSelect from '../TxClientSearchSelect'
import RegimenFolderFields from '../RegimenFolderFields'
import TbStatusSelect from '../TbStatusSelect'
import PregnancyStatusSelect from '../PregnancyStatusSelect'
import FolderSelect from '../FolderSelect'
import EntryBadge from '../EntryBadge'
import SavePreviewModal, { SavePreviewSections } from '../SavePreviewModal'
import ConcurrencePreviewTable from '../ConcurrencePreviewTable'
import MismatchResolutionModal from '../MismatchResolutionModal'

const EMPTY_FOLDER = {
  folderSex: '', folderAge: '', folderArtStart: '', folderRegLine: '',
  folderRegStart: '', folderPickup: '', folderRefill: '', folderTb: '', folderPreg: '',
}

const EMPTY_EMR_ONLY = { pbs: '', recapture: '', recDate: '', remarks: '' }

export default function FieldTxView() {
  const {
    show, loadSaved, preloadTx, preloadTxLarge, txIndex, txSaved, loading: bootstrapLoading,
    globalState, globalFacility, saveEntry, upsertTxSaved,
    defaultPeriod, activeTxPreload,
  } = useFieldEntry()

  const [txFacility, setTxFacility] = useState('')
  const [txClientIdx, setTxClientIdx] = useState('')
  const [txAssessmentDate, setTxAssessmentDate] = useState('')
  const [txAssessor, setTxAssessor] = useState('')
  const [txFound, setTxFound] = useState('')
  const [folder, setFolder] = useState({ ...EMPTY_FOLDER })
  const [emrOnly, setEmrOnly] = useState({ ...EMPTY_EMR_ONLY })
  const [saving, setSaving] = useState(false)
  const [txPreviewOpen, setTxPreviewOpen] = useState(false)
  const [pendingTxSave, setPendingTxSave] = useState(null)
  const [mismatchResolutions, setMismatchResolutions] = useState({})
  const [resolutionDraft, setResolutionDraft] = useState(EMPTY_MISMATCH_RESOLUTION)
  const [resolutionTarget, setResolutionTarget] = useState(null)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [hasSavedEntry, setHasSavedEntry] = useState(false)
  const [remoteClients, setRemoteClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientTotal, setClientTotal] = useState(0)

  const txFacilities = useMemo(() => {
    if (preloadTxLarge && txIndex?.facilitiesByState) {
      let list = txIndex.facilitiesByState[globalState] || []
      if (globalFacility) list = list.filter(f => f === globalFacility)
      return list
    }
    return unique(
      preloadTx.filter(r =>
        (!globalState || r.state === globalState) &&
        (!globalFacility || r.facilityName === globalFacility)
      ).map(r => r.facilityName),
    )
  }, [preloadTxLarge, txIndex, preloadTx, globalState, globalFacility])

  const txClientsByFacility = useMemo(() => {
    if (preloadTxLarge) return new Map()
    const map = new Map()
    for (const r of preloadTx) {
      if (globalState && r.state !== globalState) continue
      if (globalFacility && r.facilityName !== globalFacility) continue
      const f = r.facilityName
      if (!f) continue
      let list = map.get(f)
      if (!list) {
        list = []
        map.set(f, list)
      }
      list.push(r)
    }
    return map
  }, [preloadTxLarge, preloadTx, globalState, globalFacility])

  const inlineClients = useMemo(
    () => (txFacility ? txClientsByFacility.get(txFacility) || [] : []),
    [txClientsByFacility, txFacility],
  )

  const txClients = preloadTxLarge ? remoteClients : inlineClients

  const fetchRemoteClients = useCallback(async (q = '') => {
    if (!preloadTxLarge || !txFacility) {
      setRemoteClients([])
      setClientTotal(0)
      return
    }
    setClientsLoading(true)
    try {
      const params = new URLSearchParams({ facility: txFacility })
      if (globalState) params.set('state', globalState)
      if (q) params.set('q', q)
      const res = await fetch(`/api/field/tx-clients?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load clients')
      const data = await res.json()
      setRemoteClients(data.clients || [])
      setClientTotal(data.total || 0)
    } catch {
      setRemoteClients([])
      setClientTotal(0)
    } finally {
      setClientsLoading(false)
    }
  }, [preloadTxLarge, txFacility, globalState])

  useEffect(() => {
    if (!preloadTxLarge) return
    setTxClientIdx('')
    fetchRemoteClients('')
  }, [preloadTxLarge, txFacility, globalState, fetchRemoteClients])

  const selectedTx = txClientIdx !== '' ? txClients[+txClientIdx] : null

  const selectedClientKey = useMemo(() => {
    if (!selectedTx) return ''
    return [
      selectedTx.facilityName,
      resolveTxClientPeriod(selectedTx, defaultPeriod, activeTxPreload),
      normalizeTxId(selectedTx.patientId),
      normalizeTxId(selectedTx.pepId),
    ].join('|')
  }, [selectedTx, defaultPeriod, activeTxPreload])

  const txSavedRef = useRef(txSaved)
  txSavedRef.current = txSaved

  const selectedTxRef = useRef(selectedTx)
  selectedTxRef.current = selectedTx

  const defaultPeriodRef = useRef(defaultPeriod)
  defaultPeriodRef.current = defaultPeriod

  const activeTxPreloadRef = useRef(activeTxPreload)
  activeTxPreloadRef.current = activeTxPreload

  const applySavedRecordRef = useRef(null)
  const upsertTxSavedRef = useRef(upsertTxSaved)
  upsertTxSavedRef.current = upsertTxSaved

  const txMetrics = useMemo(() => calcTxMetrics(selectedTx, folder, emrOnly), [selectedTx, folder, emrOnly])
  const pharmacyPickupMatch = useMemo(() => {
    if (!selectedTx) return ''
    const emr = normalizeDateText(selectedTx.pharmacyLastPickupdate)
    const folderVal = normalizeDateText(folder.folderPickup)
    if (!emr && !folderVal) return ''
    return same(folder.folderPickup, selectedTx.pharmacyLastPickupdate, true)
  }, [selectedTx, folder.folderPickup])
  const pregnancyLocked = (folder.folderSex || '').trim().toUpperCase() === 'M'
  const recaptureDateLocked = (emrOnly.recapture || '').trim().toLowerCase() === 'no'
  const entryDisabled = !selectedTx || !txFound
  const disabledFieldStyle = { background: '#f1f5f9' }

  function setRecordFound(val) {
    setTxFound(val)
    if (!val) {
      setFolder({ ...EMPTY_FOLDER })
      setEmrOnly({ ...EMPTY_EMR_ONLY })
    }
  }

  function setRecapture(val) {
    setEmrOnly(o => ({
      ...o,
      recapture: val,
      recDate: val === 'No' ? '' : o.recDate,
    }))
  }

  const applySavedRecord = useCallback((match) => {
    if (!match) {
      setHasSavedEntry(false)
      setFolder({ ...EMPTY_FOLDER })
      setEmrOnly({ ...EMPTY_EMR_ONLY })
      setTxAssessor('')
      setTxFound('')
      setMismatchResolutions({})
      setTxAssessmentDate(fmtDate(new Date()))
      return
    }
    setHasSavedEntry(true)
    const f = savedTxToForm(match)
    setTxAssessmentDate(f.assessmentDate || fmtDate(new Date()))
    setTxAssessor(f.assessor || '')
    setTxFound(f.recordFound || '')
    setFolder({
      folderSex: f.folderSex, folderAge: f.folderAge, folderArtStart: f.folderArtStart,
      folderRegLine: resolveRegimenLineSelectValue(f.folderRegLine, f.folderRegStart),
      folderRegStart: resolveRegimenSelectValue(f.folderRegStart),
      folderPickup: f.folderPickup, folderRefill: f.folderRefill,
      folderTb: resolveTbStatusSelectValue(f.folderTb),
      folderPreg: resolvePregnancyStatusSelectValue(f.folderPreg),
    })
    setEmrOnly({
      pbs: f.pbs,
      recapture: f.recapture,
      recDate: (f.recapture || '').trim().toLowerCase() === 'no' ? '' : f.recDate,
      remarks: f.remarks,
    })
    setMismatchResolutions(normalizeResolutionMap(f.mismatchResolutions))
  }, [])

  applySavedRecordRef.current = applySavedRecord

  useEffect(() => {
    if (!txAssessmentDate) setTxAssessmentDate(fmtDate(new Date()))
  }, [txAssessmentDate])

  useEffect(() => {
    const client = selectedTxRef.current
    if (!selectedClientKey || !client) {
      setHasSavedEntry(false)
      setLoadingSaved(false)
      if (!client) {
        setFolder({ ...EMPTY_FOLDER })
        setEmrOnly({ ...EMPTY_EMR_ONLY })
        setTxFound('')
        setMismatchResolutions({})
      }
      return
    }

    const ctx = {
      defaultPeriod: defaultPeriodRef.current,
      activeTxPreload: activeTxPreloadRef.current,
    }
    const cached = matchSavedTxRecord(client, txSavedRef.current, ctx)
    if (cached) {
      applySavedRecordRef.current?.(cached)
    } else {
      setHasSavedEntry(false)
      setTxFound('')
      setFolder({ ...EMPTY_FOLDER })
      setEmrOnly({ ...EMPTY_EMR_ONLY })
    }

    let cancelled = false
    setLoadingSaved(!cached)

    const period = resolveTxClientPeriod(client, ctx.defaultPeriod, ctx.activeTxPreload)
    const params = new URLSearchParams({ facilityName: client.facilityName || '' })
    if (period) params.set('period', period)

    fetch(`/api/tx?${params}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then(list => {
        if (cancelled) return
        const fromServer = matchSavedTxRecord(client, list, ctx)
        applySavedRecordRef.current?.(fromServer)
        if (fromServer) upsertTxSavedRef.current(fromServer)
      })
      .catch(() => {
        if (!cancelled && !cached) applySavedRecordRef.current?.(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false)
      })

    return () => { cancelled = true }
  }, [selectedClientKey])

  function setFolderField(key, val) {
    setFolder(f => {
      const next = { ...f, [key]: val }
      if (key === 'folderSex' && String(val).trim().toUpperCase() === 'M') next.folderPreg = ''
      return next
    })
  }

  function requestSaveTx() {
    if (!selectedTx) { show('Select a preloaded facility and client first.', false); return }
    const period = String(selectedTx.dqaPeriod || defaultPeriod || activeTxPreload?.period || '').trim()
    const state = String(selectedTx.state || globalState || '').trim()
    if (!period) {
      show('DQA period is missing. Lock a TX line list that includes a period, or set period on upload.', false)
      return
    }
    if (!state) {
      show('State is missing. Select a state from the line list filters above.', false)
      return
    }
    const assessor = resolveAssessor(txAssessor)
    if (!assessor) {
      show(ASSESSOR_REQUIRED_MSG, false, { useAlert: true })
      return
    }
    if (!txFound) {
      show('Select Record FOUND (Yes or No) before entering or saving data.', false, { useAlert: true })
      return
    }

    const body = txRowToApi(
      period, state, selectedTx.lga, selectedTx.facilityName,
      selectedTx.datimCode, selectedTx.patientId, selectedTx.pepId,
      assessor, txAssessmentDate, txFound,
      selectedTx, folder, emrOnly, txMetrics,
      { periodFy: selectedTx.periodFy, patientHospitalNo: selectedTx.patientHospitalNo },
    )
    const label = `TX · ${selectedTx.pepId || selectedTx.patientId || 'client'}`
    const concurrenceRows = buildTxConcurrenceRows(selectedTx, folder)

    setResolutionTarget(null)
    setPendingTxSave({
      body,
      label,
      concurrenceRows,
      sections: [
        {
          title: 'Client & assessment',
          rows: [
            ['DQA period', period],
            ['State', state],
            ['LGA', selectedTx.lga || '—'],
            ['Facility', selectedTx.facilityName || '—'],
            ['PepID', selectedTx.pepId || '—'],
            ['Patient ID', selectedTx.patientId || '—'],
            ['Assessor', assessor],
            ['Date of assessment', txAssessmentDate || '—'],
            ['Record FOUND', txFound],
          ],
        },
        {
          title: 'Scorecard',
          rows: [
            ['Folder completeness %', `${txMetrics.folderPct}%`],
            ['Match count', `${txMetrics.matchCount} / 9`],
            ['Concurrence %', `${txMetrics.concPct}%`],
            ['EMR-only completeness %', `${txMetrics.emrPct}%`],
          ],
        },
        {
          title: 'Folder (validated on site)',
          rows: [
            ['Sex', folder.folderSex || '—'],
            ['Age at ART start', folder.folderAge || '—'],
            ['ART start date', normalizeDateText(folder.folderArtStart) || '—'],
            ['Regimen line', resolveRegimenLineSelectValue(folder.folderRegLine, folder.folderRegStart) || '—'],
            ['Regimen', resolveRegimenSelectValue(folder.folderRegStart) || '—'],
            ['Pharmacy last pickup', normalizeDateText(folder.folderPickup) || '—'],
            ['Days of ARV refill', folder.folderRefill || '—'],
            ['TB status', resolveTbStatusSelectValue(folder.folderTb) || '—'],
            ['Pregnancy status', resolvePregnancyStatusSelectValue(folder.folderPreg) || '—'],
          ],
        },
        {
          title: 'EMR-only fields',
          rows: [
            ['PBS (Base Print) EMR', emrOnly.pbs || '—'],
            ['recapture_EMR', emrOnly.recapture || '—'],
            ['date_of_recapture_EMR', normalizeDateText(emrOnly.recDate) || '—'],
            ['Recapture validation', recaptureDateLocked ? 'Not required' : (txMetrics.recVal || '—')],
            ['Remarks', emrOnly.remarks || '—'],
          ],
        },
      ],
    })
    setTxPreviewOpen(true)
  }

  async function confirmSaveTx() {
    if (!pendingTxSave) return
    const mismatchRows = (pendingTxSave.concurrenceRows || []).filter(r => r.isMismatch)
    const unresolved = mismatchRows.filter(r => !isResolutionComplete(mismatchResolutions[r.key]))
    if (unresolved.length) {
      show('Resolve all mismatches before saving.', false, { useAlert: true })
      return
    }

    const saveBody = {
      ...pendingTxSave.body,
      remarks: pendingTxSave.body.remarks,
      mismatchResolutions: normalizeResolutionMap(mismatchResolutions),
    }

    setSaving(true)
    try {
      const result = await saveEntry({
        type: 'tx',
        url: '/api/tx',
        body: saveBody,
        label: pendingTxSave.label,
      })
      if (result.error) {
        show(result.error, false, { useAlert: true })
        return
      }
      if (result.queued) {
        show('Saved on this device. Will sync to the server when internet is available.', true, { useAlert: true })
        setMismatchResolutions(normalizeResolutionMap(saveBody.mismatchResolutions))
      } else {
        if (result.data) {
          upsertTxSaved(result.data)
          const restored = savedTxToForm(result.data)
          const fromServer = restored?.mismatchResolutions
          const hasServerResolutions = fromServer && Object.keys(fromServer).length > 0
          setMismatchResolutions(normalizeResolutionMap(
            hasServerResolutions ? fromServer : saveBody.mismatchResolutions,
          ))
        } else {
          setMismatchResolutions(normalizeResolutionMap(saveBody.mismatchResolutions))
        }
        setHasSavedEntry(true)
        show('TX validation row saved successfully.', true, { useAlert: true })
        await loadSaved()
      }
      setTxPreviewOpen(false)
      setPendingTxSave(null)
      setResolutionTarget(null)
    } catch {
      show('Save failed. Please try again.', false, { useAlert: true })
    } finally {
      setSaving(false)
    }
  }

  function closeTxPreview() {
    if (saving) return
    setTxPreviewOpen(false)
    setPendingTxSave(null)
    setResolutionTarget(null)
  }

  function openResolution(row) {
    setResolutionTarget(row)
    setResolutionDraft(mismatchResolutions[row.key] || { ...EMPTY_MISMATCH_RESOLUTION })
  }

  function saveResolutionDraft() {
    if (!resolutionTarget) return
    if (!isResolutionComplete(resolutionDraft)) {
      show('Issues/gaps is required in the resolution form.', false, { useAlert: true })
      return
    }
    setMismatchResolutions(prev => ({ ...prev, [resolutionTarget.key]: { ...resolutionDraft } }))
    setResolutionTarget(null)
  }

  const txMismatchRows = (pendingTxSave?.concurrenceRows || []).filter(r => r.isMismatch)
  const txCanConfirmSave = txMismatchRows.every(r => isResolutionComplete(mismatchResolutions[r.key]))
  const txShowConcurrenceTable = (pendingTxSave?.concurrenceRows || []).length > 0
  const preloadPending = bootstrapLoading && !txFacilities.length && !txIndex

  function clearTxInputs() {
    setFolder({ ...EMPTY_FOLDER })
    setEmrOnly({ ...EMPTY_EMR_ONLY })
  }

  return (
    <>
      <div className="tx-scorecard-bar">
        <div className="entry-section tx-scorecard-heading">
          <h3>Validation scorecard</h3>
          <span className="muted">Updates as you enter folder and EMR values</span>
        </div>
        <div className="grid4 tx-scorecard-grid">
          <div className="entry-card entry-kpi"><div className="k">Folder completeness %</div><div className="v">{txMetrics.folderPct}%</div><div className="s">Comparable folder fields documented</div></div>
          <div className="entry-card entry-kpi"><div className="k">Match count</div><div className="v">{txMetrics.matchCount}</div><div className="s">Out of 9 comparable fields</div></div>
          <div className="entry-card entry-kpi"><div className="k">Concurrence %</div><div className="v">{txMetrics.concPct}%</div><div className="s">Auto-calculated from folder vs EMR</div></div>
          <div className="entry-card entry-kpi"><div className="k">EMR-only completeness %</div><div className="v">{txMetrics.emrPct}%</div><div className="s">Counts Not Required as complete for recapture date</div></div>
        </div>
      </div>

      <SuspenseSection pending={preloadPending} rows={6}>
      <div className="tx-entry-toolbar">
        <div className="entry-card">
          <label>Preloaded TX facility</label>
          <select value={txFacility} onChange={e => { setTxFacility(e.target.value); setTxClientIdx('') }}>
            <option value="">{txFacilities.length ? 'Select facility' : 'No preloaded TX facilities'}</option>
            {txFacilities.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="entry-card entry-card-client">
          <label>Preloaded TX client{clientTotal > 0 ? ` (${clientTotal})` : txClients.length > 0 ? ` (${txClients.length})` : ''}</label>
          <TxClientSearchSelect
            clients={txClients}
            value={txClientIdx}
            onChange={setTxClientIdx}
            disabled={!txFacilities.length || !txFacility}
            loading={clientsLoading}
            remoteSearch={preloadTxLarge}
            onRemoteQuery={fetchRemoteClients}
          />
        </div>
        <div className="entry-card">
          <label>Date of Assessment</label>
          <input type="date" value={txAssessmentDate} onChange={e => setTxAssessmentDate(e.target.value)} />
        </div>
        <div className="entry-card">
          <label className="label-required">Assessor</label>
          <input value={txAssessor} onChange={e => setTxAssessor(e.target.value)} placeholder="Enter assessor name" />
        </div>
        <div className="entry-card entry-card-narrow">
          <label>Record FOUND</label>
          <select value={txFound} onChange={e => setRecordFound(e.target.value)} disabled={!selectedTx}>
            <option value="">Select…</option>
            <option>Yes</option><option>No</option>
          </select>
        </div>
      </div>

      <div className="entry-card mt12">
        <div className="entry-section"><h3>Preloaded identifiers and EMR values</h3><span className="muted">Read-only from HQ preload</span></div>
        <div className="grid5">
          {[
            ['DQA Period', selectedTx?.dqaPeriod],
            ['State', selectedTx?.state],
            ['LGA', selectedTx?.lga],
            ['Facility', selectedTx?.facilityName],
            ['DATIM code', selectedTx?.datimCode],
            ['Patient ID', selectedTx?.patientId],
            ['PepID', selectedTx?.pepId],
            ['Sex (EMR)', selectedTx?.sex],
            ['Age at ART start (EMR)', selectedTx?.ageatstartofart],
            ['ART start date (EMR)', selectedTx?.artStartDate],
            ['Regimen line at ART start (EMR)', resolveRegimenLineSelectValue(selectedTx?.regimenLineAtArtStart, selectedTx?.regimenAtArtStart)],
            ['Regimen at ART start (EMR)', resolveRegimenSelectValue(selectedTx?.regimenAtArtStart)],
            ['Pharmacy last pickup (EMR)', selectedTx?.pharmacyLastPickupdate],
            ['Days of ARV refill (EMR)', selectedTx?.daysOfArvRefill],
            ['Current TB status (EMR)', selectedTx?.currentTbStatus],
            ['Current pregnancy status (EMR)', selectedTx?.currentPregnancyStatus],
          ].map(([lbl, val]) => {
            const isDate = lbl === 'ART start date (EMR)' || lbl === 'Pharmacy last pickup (EMR)'
            const display = isDate ? normalizeDateText(val) || '' : (val || '')
            return (
            <div key={lbl}><label>{lbl}</label><input readOnly value={display} /></div>
          )})}
        </div>
      </div>

      <SuspenseSection pending={loadingSaved} rows={4}>
      <div className="entry-card subtle mt12">
        <div className="entry-section">
          <h3>Document validated folder components on site</h3>
          <span className="muted">
            {!txFound
              ? 'Select Record FOUND (Yes or No) to enable data entry'
              : hasSavedEntry
                ? 'Saved entry loaded — edit and save again to update'
                : 'Results auto-calculated'}
          </span>
        </div>
        <div className="grid3">
          <FolderSelect
            label="Sex (Folder)"
            value={folder.folderSex}
            onChange={val => setFolderField('folderSex', val)}
            options={['M', 'F']}
            placeholder="Select sex"
            disabled={entryDisabled}
          />
          <div><label>Age at ART start (Folder)</label><input value={folder.folderAge} onChange={e => setFolderField('folderAge', e.target.value)} disabled={entryDisabled} style={entryDisabled ? disabledFieldStyle : undefined} /></div>
          <div><label>ART start date (Folder)</label><input type="date" value={normalizeDateText(folder.folderArtStart)} onChange={e => setFolderField('folderArtStart', e.target.value)} disabled={entryDisabled} style={entryDisabled ? disabledFieldStyle : undefined} /></div>
          <RegimenFolderFields
            lineValue={folder.folderRegLine}
            regimenValue={folder.folderRegStart}
            onLineChange={val => setFolderField('folderRegLine', val)}
            onRegimenChange={val => setFolderField('folderRegStart', val)}
            selectedTx={selectedTx}
            folderValues={folder}
            disabled={entryDisabled}
          />
          <div>
            <label>Pharmacy last pickup (Folder)</label>
            <input type="date" value={normalizeDateText(folder.folderPickup)} onChange={e => setFolderField('folderPickup', e.target.value)} disabled={entryDisabled} style={entryDisabled ? disabledFieldStyle : undefined} />
            {pharmacyPickupMatch ? (
              <div style={{ marginTop: 6 }}><EntryBadge text={pharmacyPickupMatch} /></div>
            ) : null}
          </div>
          <div><label>Days of ARV refill (Folder)</label><input value={folder.folderRefill} onChange={e => setFolderField('folderRefill', e.target.value)} disabled={entryDisabled} style={entryDisabled ? disabledFieldStyle : undefined} /></div>
          <TbStatusSelect
            value={folder.folderTb}
            onChange={val => setFolderField('folderTb', val)}
            disabled={entryDisabled}
          />
          <PregnancyStatusSelect
            value={folder.folderPreg}
            onChange={val => setFolderField('folderPreg', val)}
            disabled={entryDisabled || pregnancyLocked}
          />
        </div>
      </div>

      <div className="entry-card mt12">
        <div className="entry-section"><h3>EMR-only fields</h3><span className="muted">Editable on site</span></div>
        <div className="grid4">
          <div>
            <label>PBS (Base Print) EMR</label>
            <select value={emrOnly.pbs} onChange={e => setEmrOnly(o => ({ ...o, pbs: e.target.value }))} disabled={entryDisabled}>
              <option value="">Select</option><option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label>recapture_EMR</label>
            <select value={emrOnly.recapture} onChange={e => setRecapture(e.target.value)} disabled={entryDisabled}>
              <option value="">Select</option><option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label>date_of_recapture_EMR</label>
            <input
              type="date"
              value={emrOnly.recDate}
              onChange={e => setEmrOnly(o => ({ ...o, recDate: e.target.value }))}
              disabled={entryDisabled || recaptureDateLocked}
              readOnly={recaptureDateLocked}
              style={(entryDisabled || recaptureDateLocked) ? disabledFieldStyle : undefined}
              title={recaptureDateLocked ? 'Not required when recapture_EMR is No' : ''}
            />
          </div>
          <div>
            <label>date_of_recapture validation</label>
            <input
              readOnly
              disabled={entryDisabled || recaptureDateLocked}
              value={recaptureDateLocked ? 'Not required' : txMetrics.recVal}
              style={(entryDisabled || recaptureDateLocked) ? disabledFieldStyle : undefined}
              title={recaptureDateLocked ? 'Not required when recapture_EMR is No' : ''}
            />
          </div>
        </div>
        <div className="mt12"><label>Remarks / Comment</label><textarea value={emrOnly.remarks} onChange={e => setEmrOnly(o => ({ ...o, remarks: e.target.value }))} disabled={entryDisabled} style={entryDisabled ? disabledFieldStyle : undefined} /></div>
      </div>
      </SuspenseSection>

      <div className="inlineActions mt12">
        <button type="button" className="entry-btn" onClick={requestSaveTx} disabled={saving || entryDisabled}>{saving ? 'Saving…' : 'Save TX validation row'}</button>
        <button type="button" className="entry-btn secondary" onClick={clearTxInputs} disabled={entryDisabled}>Clear TX form inputs</button>
      </div>
      </SuspenseSection>

      <SavePreviewModal
        open={txPreviewOpen}
        title="Preview TX validation save"
        subtitle={
          txMismatchRows.length
            ? 'Review concurrence below. Resolve each mismatch, then confirm save.'
            : 'Review the values below. Data is saved only when you click Confirm & save.'
        }
        onClose={closeTxPreview}
        onConfirm={confirmSaveTx}
        confirming={saving}
        confirmDisabled={!txCanConfirmSave}
        showConfirm={txCanConfirmSave || txMismatchRows.length === 0}
      >
        {pendingTxSave && txShowConcurrenceTable ? (
          <ConcurrencePreviewTable
            rows={pendingTxSave.concurrenceRows}
            resolutions={mismatchResolutions}
            onResolve={openResolution}
          />
        ) : null}
        {pendingTxSave ? <SavePreviewSections sections={pendingTxSave.sections} /> : null}
      </SavePreviewModal>

      <MismatchResolutionModal
        open={!!resolutionTarget}
        fieldLabel={resolutionTarget?.label || ''}
        emrValue={resolutionTarget?.emr}
        folderValue={resolutionTarget?.folder}
        resolution={resolutionDraft}
        onChange={setResolutionDraft}
        onClose={() => setResolutionTarget(null)}
        onSave={saveResolutionDraft}
      />
    </>
  )
}
