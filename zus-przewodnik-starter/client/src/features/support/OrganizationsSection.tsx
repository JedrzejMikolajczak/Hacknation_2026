import type { CharitableOrganization } from '@shared/types';

interface OrganizationsDetailsProps {
  organizations: CharitableOrganization[];
  defaultOpen: boolean;
}

export function OrganizationsDetails({ organizations, defaultOpen }: OrganizationsDetailsProps) {
  return (
    <details className="support-accordion" open={defaultOpen || undefined}>
      <summary className="support-accordion__summary">
        Organizacje charytatywne – bezpłatna pomoc
      </summary>
      <div className="support-accordion__body">
        <p className="support-accordion__intro">
          Wyłącznie organizacje o charakterze charytatywnym (fundacje i organizacje pożytku
          publicznego) oferujące bezpłatną pomoc rodzicom w szczególnych sytuacjach.
        </p>
        <div className="support-orgs-grid">
          {organizations.map((org) => (
            <article key={org.id} className="support-org-tile">
              <div className="support-org-tile__meta">
                <span className="plan-badge plan-badge--navy">{org.helps_with}</span>
                <span className="support-org-tile__form">{org.legal_form}</span>
              </div>
              <h4 className="support-org-tile__title">{org.name}</h4>
              <p className="support-org-tile__desc">{org.description}</p>
              <a
                href={org.url}
                target="_blank"
                rel="noopener noreferrer"
                className="support-org-tile__link"
              >
                Przejdź do strony fundacji ›
                <span className="visually-hidden"> (otwiera się w nowej karcie)</span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}
