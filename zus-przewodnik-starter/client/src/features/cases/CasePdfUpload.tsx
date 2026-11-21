import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { CaseInputs, CasePlan } from '@shared/types';
import { apiPost } from '../../api/client';
import { extractCaseFields, toPdfCaseInputs, type ExtractedFields } from './pdfCaseFields';
import { MAX_PDF_BYTES, readCasePdf } from './readCasePdf';

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

function YesNoField({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label>
      {children}
      <select name={name}>
        <option value="">Nie wiadomo</option>
        <option value="yes">Tak</option>
        <option value="no">Nie</option>
      </select>
    </label>
  );
}

function Calculation({ result }: { result: CasePlan }) {
  const amount = result.outcome.calculated_amount_pln;
  return (
    <section className="cases-upload__result" aria-labelledby="pdf-calculation-heading">
      <h3 id="pdf-calculation-heading">Wynik kalkulatora</h3>
      <p role="status">{result.outcome.decision_summary_pl}</p>
      {amount !== null && (
        <p>
          Łączna kwota brutto <strong>{money.format(amount)}</strong>
        </p>
      )}
      {result.outcome.benefit_base_pln !== null && (
        <p>
          Podstawa wymiaru <strong>{money.format(result.outcome.benefit_base_pln)}</strong>
        </p>
      )}
      {result.outcome.granted_duration_days > 0 && (
        <p>Okres świadczenia: {result.outcome.granted_duration_days} dni.</p>
      )}
      {result.validation_errors.length > 0 && (
        <ul>
          {result.validation_errors.map((item, index) => (
            <li key={`${item.code}-${index}`}>{item.message_pl}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PdfConfirmationForm({ fields }: { fields: ExtractedFields }) {
  const [stage, setStage] = useState<CaseInputs['stage'] | ''>('');
  const [employment, setEmployment] = useState<CaseInputs['employment_type'] | ''>('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<CasePlan>();

  function invalidate() {
    setConfirmed(false);
    setResult(undefined);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending) return;
    setError(undefined);
    setResult(undefined);
    setPending(true);
    try {
      const input = toPdfCaseInputs(new FormData(event.currentTarget));
      setResult(await apiPost<CasePlan>('/plan', input));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Nie udało się przeliczyć tej sprawy.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={pending} className="cases-upload__fieldset">
          <legend>Sprawdź i uzupełnij pola</legend>
          <div className="cases-upload__fields" onChange={invalidate}>
            <label>
              Sytuacja
              <select
                name="stage"
                required
                value={stage}
                onChange={(event) => setStage(event.target.value as typeof stage)}
              >
                <option value="">Wybierz sytuację</option>
                <option value="POST_BIRTH">Po porodzie</option>
                <option value="PREGNANCY">Chorobowe w ciąży</option>
                <option value="ADOPTION">Adopcja lub niezawodowa rodzina zastępcza</option>
              </select>
            </label>
            <label>
              Wnioskodawca
              <select name="applicant" required defaultValue="">
                <option value="">Wybierz rodzica</option>
                <option value="MOTHER">Matka</option>
                <option value="FATHER">Ojciec</option>
              </select>
            </label>
            <label>
              Tytuł ubezpieczenia
              <select
                name="employment"
                required
                value={employment}
                onChange={(event) => setEmployment(event.target.value as typeof employment)}
              >
                <option value="">Wybierz tytuł</option>
                <option value="UOP">Umowa o pracę</option>
                <option value="ZLECENIE">Umowa zlecenia</option>
                <option value="B2B">Działalność gospodarcza</option>
                <option value="NONE">Brak tytułu</option>
              </select>
            </label>
            {stage === 'POST_BIRTH' && (
              <label>
                Data porodu
                <input name="birthDate" type="date" required defaultValue={fields.birthDate} />
              </label>
            )}
            {stage === 'PREGNANCY' && (
              <>
                <label>
                  Przewidywana data porodu
                  <input name="dueDate" type="date" defaultValue={fields.dueDate} />
                </label>
                <label>
                  Początek zwolnienia
                  <input
                    name="sicknessStart"
                    type="date"
                    required
                    defaultValue={fields.sicknessStart}
                  />
                </label>
                <label>
                  Koniec zwolnienia
                  <input
                    name="sicknessEnd"
                    type="date"
                    required
                    defaultValue={fields.sicknessEnd}
                  />
                </label>
                <YesNoField name="codeB">Kod B na e-ZLA</YesNoField>
                {employment === 'UOP' && (
                  <YesNoField name="age50">
                    Czy obowiązuje limit 14 dni wynagrodzenia chorobowego?
                  </YesNoField>
                )}
              </>
            )}
            {stage === 'ADOPTION' && (
              <>
                <label>
                  Data przyjęcia dziecka
                  <input
                    name="acceptanceDate"
                    type="date"
                    required
                    defaultValue={fields.acceptanceDate}
                  />
                </label>
                <label>
                  Forma przyjęcia dziecka
                  <select name="adoptionType" required defaultValue="">
                    <option value="">Wybierz formę</option>
                    <option value="ADOPTION">Przysposobienie</option>
                    <option value="FOSTER_FAMILY">Niezawodowa rodzina zastępcza</option>
                  </select>
                </label>
                <label>
                  Wiek dziecka w chwili przyjęcia
                  <input name="childAge" type="number" min="0" step="1" required />
                </label>
              </>
            )}
            {stage && stage !== 'PREGNANCY' && (
              <>
                <label>
                  Liczba dzieci
                  <input
                    name="children"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={fields.children}
                  />
                </label>
                <label>
                  Data złożenia wniosku
                  <input name="applicationDate" type="date" defaultValue={fields.applicationDate} />
                </label>
                <label>
                  Wariant wypłaty
                  <select name="payment">
                    <option value="SPLIT_100_70">Standardowy</option>
                    <option value="COMBINED_81_5">Wariant 81,5%</option>
                  </select>
                </label>
                <label className="cases-upload__checkbox">
                  <input name="zaZyciem" type="checkbox" /> Zaświadczenie „Za życiem”
                </label>
              </>
            )}
            {employment && employment !== 'NONE' && (
              <>
                <label>
                  Podstawa wymiaru w zł
                  <input name="base" type="number" min="0" step="0.01" defaultValue={fields.base} />
                </label>
                <label>
                  Liczba dni ubezpieczenia
                  <input name="insuranceDays" type="number" min="0" step="1" />
                </label>
                <label>
                  Data końca ubezpieczenia
                  <input name="contractEnd" type="date" />
                </label>
              </>
            )}
            {(employment === 'UOP' || employment === 'ZLECENIE') && (
              <label>
                Liczba ubezpieczonych u płatnika na 30 listopada
                <select name="insuredCount">
                  <option value="">Nie wiadomo</option>
                  <option value="<= 20">Do 20</option>
                  <option value="> 20">Powyżej 20</option>
                </select>
              </label>
            )}
            {(employment === 'ZLECENIE' || employment === 'B2B') && (
              <YesNoField name="voluntary">Dobrowolne ubezpieczenie chorobowe</YesNoField>
            )}
            {employment === 'B2B' && (
              <YesNoField name="arrears">
                Zadłużenie składkowe przekraczające ustawowy próg
              </YesNoField>
            )}
          </div>
          <label className="cases-upload__checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Potwierdzam, że sprawdziłem lub sprawdziłam pola przed obliczeniem.
          </label>
          <button type="submit" disabled={!confirmed || pending}>
            {pending ? 'Przeliczamy…' : 'Przelicz potwierdzone dane'}
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
      {result && <Calculation result={result} />}
    </>
  );
}

export function CasePdfUpload() {
  const read = useRef<AbortController>();
  const [fileError, setFileError] = useState<string>();
  const [upload, setUpload] = useState<{ file: File; fields?: ExtractedFields; note: string }>();
  const [revision, setRevision] = useState(0);

  useEffect(
    () => () => {
      read.current?.abort();
      read.current = undefined;
    },
    [],
  );

  async function selectFile(file: File | undefined) {
    read.current?.abort();
    read.current = undefined;
    setUpload(undefined);
    setFileError(undefined);
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setFileError('Wybierz plik PDF.');
      return;
    }
    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      setFileError('Wybierz niepusty plik PDF do 12 MB.');
      return;
    }
    const controller = new AbortController();
    read.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    setRevision((value) => value + 1);
    setUpload({ file, note: 'Odczytujemy pola w przeglądarce…' });
    try {
      const fields = extractCaseFields(await readCasePdf(file, controller.signal));
      if (read.current !== controller) return;
      const count = Object.values(fields).filter(Boolean).length;
      setUpload({
        file,
        fields,
        note: count
          ? 'Część pól została uzupełniona. Porównaj je z PDF-em i popraw w razie potrzeby.'
          : 'Brak rozpoznanych pól. Jeśli to skan lub dokument ma inny układ, wpisz dane ręcznie.',
      });
    } catch {
      if (read.current !== controller) return;
      setUpload({
        file,
        fields: {},
        note: 'Nie udało się odczytać dokumentu. Możesz uzupełnić dane ręcznie.',
      });
    } finally {
      window.clearTimeout(timer);
      if (read.current === controller) read.current = undefined;
    }
  }

  return (
    <section className="cases-panel cases-upload" aria-labelledby="pdf-upload-heading">
      <h2 id="pdf-upload-heading">Wczytaj własny wniosek PDF</h2>
      <p>
        PDF zostaje w przeglądarce. Kalkulator otrzyma tylko pola, które sprawdzisz i potwierdzisz.
      </p>
      <label className="cases-upload__file">
        Plik PDF do 12 MB i 20 stron
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            // Pozwala ponownie wybrać ten sam plik po nieudanym odczycie.
            input.value = '';
            void selectFile(file);
          }}
        />
      </label>
      {fileError && <p role="alert">{fileError}</p>}
      {upload && (
        <>
          <p className="cases-upload__filename">
            <strong>{upload.file.name}</strong>
          </p>
          <p role="status">{upload.note}</p>
          {upload.fields && <PdfConfirmationForm key={revision} fields={upload.fields} />}
        </>
      )}
    </section>
  );
}
