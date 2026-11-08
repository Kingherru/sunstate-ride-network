import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { DsButton, DsField, DsInput, DsRadio, DsSelect, DsCheckbox } from '@/components/ds/controls';
import { getOnboarding, saveOnboardingSection, saveOnboardingProgress } from '@/lib/onboarding.functions';
import { NetworkProfileForm } from '@/components/network/NetworkProfileForm';
import { VerificationEvidence } from '@/components/portal/VerificationEvidence';
import { ProviderCredentialsPanel } from '@/components/dashboard/ProviderCredentialsPanel';
import { usePortalPreview, previewBlocked } from '@/components/portal/preview-data';
import { organizationLabel } from '@/lib/account-types';
import { AccountConnections } from '@/components/portal/AccountConnections';
import { PATIENT_RELATIONSHIP_OPTIONS } from '@/lib/patient-relationships';
import { PAYMENT_POLICY_VERSION } from '@/lib/payment-policy';
import { BusinessVisibility } from '@/components/portal/BusinessVisibility';

type SetupData = Awaited<ReturnType<typeof getOnboarding>>;
export function AccountOnboarding({ data }: { data: SetupData }) {
  const preview = usePortalPreview();
  const router = useRouter();
  const save = useServerFn(saveOnboardingSection);
  const progress = useServerFn(saveOnboardingProgress);
  const provider = data.workspace.account_type === 'provider';
  const personal = data.workspace.account_type === 'private_pay';
  const steps = ['Owner & contact', personal ? 'Patient & needs' : 'Business information', provider ? 'Services & coverage' : 'Who referred you? / Connections', provider ? 'Credentials' : 'Account review', 'Finish'];
  const [step, setStep] = useState(data.person.onboarding_completed_at ? 0 : data.person.onboarding_step ?? 0);
  const [busy, setBusy] = useState(false);
  const [accountFor, setAccountFor] = useState(data.legacy?.patient_type === 'other' ? 'another' : data.legacy?.patient_type === 'self' ? 'myself' : '');
  const [saved, setSaved] = useState(false);
  const [policyConfirmed,setPolicyConfirmed]=useState(false);
  const [npiUnavailable,setNpiUnavailable]=useState(false);
  const [relationship,setRelationship]=useState(data.legacy?.patient_relationship ?? '');
  const [form, setForm] = useState({
    firstName: data.person.first_name ?? '', lastName: data.person.last_name ?? '', phone: data.person.phone ?? '',
    display_name: data.workspace.display_name, legal_business_name: data.workspace.legal_business_name ?? '', business_phone: data.workspace.business_phone ?? '', dispatch_phone: data.workspace.dispatch_phone ?? '', business_address: data.workspace.business_address ?? '', mailing_address:data.workspace.mailing_address ?? '', operating_hours: data.workspace.operating_hours ?? '', npi: data.legacy?.npi ?? '', medicaid_number: data.legacy?.medicaid_number ?? '',
    first_name: data.patient?.first_name ?? data.person.first_name ?? '', last_name: data.patient?.last_name ?? data.person.last_name ?? '', mobility: data.patient?.mobility ?? '',
  });
  const field = (key: keyof typeof form, label: string, required = false, type = 'text', max = 160) => <DsField label={`${label} — ${required ? 'Required' : 'Optional'}`}>{p => <DsInput {...p} type={type} maxLength={max} required={required} value={form[key]} onChange={e => { setSaved(false); setForm(prev => ({ ...prev, [key]: e.target.value })); }} />}</DsField>;

  async function persist(later: boolean) {
    if (preview.active) return previewBlocked();
    setBusy(true);
    try {
      if (step === 0) await save({ data: { section: 'personal', firstName: form.firstName, lastName: form.lastName, phone: form.phone } });
      if (step === 1) {
        if (personal) await save({ data: { section: 'patient', accountFor: accountFor as 'myself' | 'another', first_name: accountFor === 'myself' ? form.firstName : form.first_name, last_name: accountFor === 'myself' ? form.lastName : form.last_name, relationship, mobility: form.mobility as 'ambulatory' | 'wheelchair' | 'stretcher' } });
        else await save({ data: { section: 'business', display_name: form.display_name, legal_business_name: form.legal_business_name, business_phone: form.business_phone, dispatch_phone: form.dispatch_phone, business_address: form.business_address, mailing_address:form.mailing_address, operating_hours: form.operating_hours, npi: provider && !npiUnavailable ? form.npi : '', medicaid_number: provider ? form.medicaid_number : '' } });
      }
      const next = later ? step : Math.min(step + 1, 4);
      await progress({ data: { step: next, complete: !later && step === 4, policyConfirmed } });
      setSaved(true);
      if (!later && step < 4) setStep(next);
      if (later) toast.success('Setup saved. You can continue from Settings.');
      if (!later && step === 4) { toast.success('Account setup complete. Verification requirements remain separate.'); await router.invalidate(); }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save setup'); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void persist(false); }
  const review = <dl className="grid gap-4 sm:grid-cols-2">
    {([['Owner', `${form.firstName} ${form.lastName}`], ['Verified account email', data.email], ['Phone', form.phone], ['Account', data.workspace.display_name], ['Account type', personal ? 'Patient / Personal' : provider ? 'Provider' : organizationLabel(data.workspace.organization_type)], ['Person MFN ID', data.person.mfn_id], ['Account MFN ID', data.workspace.mfn_id], ...(personal ? [['Patient', accountFor === 'myself' ? `${form.firstName} ${form.lastName}` : `${form.first_name} ${form.last_name}`], ['Transportation need', form.mobility]] : [['Business name', form.display_name], ['Legal name', form.legal_business_name], ['Business phone', form.business_phone], ['Dispatch phone', form.dispatch_phone], ['Private address', form.business_address], ['Operating hours', form.operating_hours], ...(provider ? [['NPI', form.npi], ['Medicaid provider number', form.medicaid_number]] : [])])] as [string, string | null][]).map(([label, value]) => <div key={label} className="min-w-0"><dt className="ds-label">{label}</dt><dd className="ds-body break-words">{value || 'Not provided'}</dd></div>)}
  </dl>;
  return <div className="portal-business-form mx-auto w-full max-w-4xl space-y-5">
    <div><h1 className="ds-page-title uppercase text-ds-primary">Account setup</h1><p className="ds-support mt-2">{provider ? 'Provider' : personal ? 'Patient / Personal' : 'Facility'} · {data.workspace.display_name}</p><p className="ds-caption mt-1">Your portal remains available. Payments and verification are separate from basic account setup.</p></div>
    <ol aria-label="Setup progress" className="grid grid-cols-5 gap-2">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`min-w-0 border-b-2 pb-2 ${index <= step ? 'border-ds-accent text-ds-primary' : 'border-ds-border text-ds-text-2'}`}><span className="ds-label">{index + 1}</span><span className="ds-caption mt-1 block break-words">{label}</span></li>)}</ol>
    <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">{steps[step]}</h2><div className="portal-business-body space-y-5">
      {(step === 0 || step === 1) ? <form id="onboarding-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {step === 0 && <>{field('firstName', 'First name', true, 'text', 80)}{field('lastName', 'Last name', true, 'text', 80)}{field('phone', 'Phone', true, 'tel', 32)}<DsField label="Verified account email — Read-only">{p => <DsInput {...p} value={data.email} readOnly />}</DsField><p className="ds-caption sm:col-span-2">Email changes use the secure confirmation process in Account &amp; Security.</p></>}
        {step === 1 && personal && <><fieldset className="sm:col-span-2"><legend className="ds-label mb-3">This account is for — Required</legend><div className="flex flex-wrap gap-4"><DsRadio name="accountFor" label="Myself" checked={accountFor === 'myself'} onChange={() => setAccountFor('myself')} /><DsRadio name="accountFor" label="Another patient" checked={accountFor === 'another'} onChange={() => setAccountFor('another')} /></div></fieldset>{accountFor === 'another' && <>{field('first_name', 'Patient first name', true, 'text', 80)}{field('last_name', 'Patient last name', true, 'text', 80)}<DsField label="Relationship / authorized contact">{p=><DsSelect {...p} value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="">Choose relationship</option>{PATIENT_RELATIONSHIP_OPTIONS.map(r=><option key={r} value={r}>{r}</option>)}</DsSelect>}</DsField><p className="ds-caption sm:col-span-2">This choice does not establish legal authority to act for the patient.</p></>}<DsField label="Transportation need — Required">{p => <DsSelect {...p} value={form.mobility} onChange={e => setForm(prev => ({ ...prev, mobility: e.target.value }))}><option value="ambulatory">Ambulatory</option><option value="wheelchair">Wheelchair</option><option value="stretcher">Gurney / Stretcher</option></DsSelect>}</DsField><p className="ds-caption sm:col-span-2">One default transportation need is supported. No diagnosis or medical records are needed.</p></>}
        {step === 1 && !personal && <>{field('display_name', provider ? 'Display business name' : 'Facility name', true)}{field('legal_business_name', 'Legal business name', provider)}{field('business_phone', 'Main business phone', true, 'tel', 32)}{field('dispatch_phone', 'Dispatch / coordination phone', false, 'tel', 32)}{field('business_address', 'Private business address', true, 'text', 300)}{field('mailing_address', 'Mailing address — if different', false, 'text', 300)}{field('operating_hours', 'Operating hours', false, 'text', 500)}{provider && <><DsCheckbox label="NPI not available yet" checked={npiUnavailable} onChange={e=>setNpiUnavailable(e.target.checked)} />{!npiUnavailable && field('npi', 'NPI', false, 'text', 10)}{field('medicaid_number', 'Medicaid provider number', false, 'text', 60)}</>}<p className="ds-caption sm:col-span-2">Account classification: {provider ? 'Provider' : organizationLabel(data.workspace.organization_type)}. Staff invitations will be available in a later step of the launch sequence.</p></>}
      </form> : step === 2 && provider ? <><p className="ds-caption">Save each service section before continuing. Public service locations are separate from private contact addresses; directory publication remains your explicit choice.</p><NetworkProfileForm workspaceId={data.workspace.id} section="operations" onboarding /><BusinessVisibility workspaceId={data.workspace.id} /></> : step === 3 && provider ? <><p className="ds-body">Credentials affect verification and Network eligibility, not account creation. An upload alone does not verify your business. You may complete this section later.</p>{!preview.active ? <><VerificationEvidence workspaceId={data.workspace.id} editable /><ProviderCredentialsPanel /></> : <p className="ds-support">Preview only. Document uploads and verification saves are unavailable.</p>}</> : step === 2 && !provider ? <p className="ds-caption">Referral and provider choices are optional and can be completed later. Save each choice separately before continuing.</p> : review}
      {step === 2 && !provider && <AccountConnections workspaceId={data.workspace.id} source="onboarding" />}
      {step === 4 && <><p className="ds-caption">Finishing setup does not start payments, grant verification, approve documents or change account access.</p><DsCheckbox checked={policyConfirmed} onChange={e=>setPolicyConfirmed(e.target.checked)} label="I acknowledge the Terms and Conditions and Privacy sections of OUR POLICIES." /><p className="ds-support"><Link to="/policies" search={{version:PAYMENT_POLICY_VERSION}} hash="terms" className="text-ds-link underline">Terms and Conditions</Link> · <Link to="/policies" search={{version:PAYMENT_POLICY_VERSION}} hash="privacy" className="text-ds-link underline">Privacy</Link></p></>}
    </div></section>
    <div className="portal-business-actions flex flex-wrap items-center gap-2">
      <DsButton variant="ghost" disabled={busy || step === 0} onClick={() => { setSaved(false); setStep(s => Math.max(0, s - 1)); }}><ArrowLeft className="size-4" />Back</DsButton>
      <DsButton variant="secondary" disabled={preview.active || busy} onClick={() => void persist(true)}><Save className="size-4" />Save for later</DsButton>
      <DsButton disabled={preview.active || busy || (step===4 && !policyConfirmed)} type={step < 2 ? 'submit' : 'button'} form={step < 2 ? 'onboarding-form' : undefined} onClick={step < 2 ? undefined : () => void persist(false)}>{busy ? 'Saving…' : step === 4 ? 'Complete setup' : 'Continue'}{step === 4 ? <Check className="size-4" /> : <ArrowRight className="size-4" />}</DsButton>
      <Link to="/portal" className="ds-support text-ds-link underline">Go to portal</Link>
    </div>
    {saved && <p role="status" className="ds-support">Saved. Your account details are available in Settings.</p>}
  </div>;
}