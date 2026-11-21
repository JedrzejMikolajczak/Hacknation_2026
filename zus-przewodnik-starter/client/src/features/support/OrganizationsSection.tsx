import type { CharitableOrganization } from './supportData';

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
                <span className="plan-badge plan-badge--navy">{org.helpsWith}</span>
                <span className="support-org-tile__form">{org.legalForm}</span>
              </div>
              <h3 className="support-org-tile__title">{org.name}</h3>
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
