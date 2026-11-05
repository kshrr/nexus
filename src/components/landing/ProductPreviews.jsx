import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Icon } from '@/components/ui';
import { HollandCodePlate } from '@/components/riasec/HollandCodePlate';

export function StationArchitecture({ desk = false }) {
  return (
    <svg
      className="rail-architecture"
      viewBox="0 0 650 470"
      preserveAspectRatio="xMidYMin meet"
      fill="none"
      aria-hidden="true"
    >
      <path d="M30 445V159L325 24L620 159V445" stroke="#A9B4AB" strokeWidth="1.5" />
      <path d="M64 445V177L325 58L586 177V445M64 178H586M30 159H620M92 431H558" stroke="#B6BEB1" />
      {[125, 325, 525].map((x) => (
        <g key={x}>
          <path
            d={`M${x - 53} 420V247A53 53 0 0 1 ${x + 53} 247V420`}
            stroke="#92A49A"
            strokeWidth="2"
          />
          <path d={`M${x - 43} 410V248A43 43 0 0 1 ${x + 43} 248V410`} stroke="#C3C9BA" />
        </g>
      ))}
      <circle cx="325" cy="125" r="30" stroke="#A0AEA1" />
      <path d="M325 106V125L339 132" stroke="#A0AEA1" />
      <path d="M0 446H650M68 460H582" stroke="#92A49A" />
      {desk ? (
        <g>
          <path d="M169 371H485V441H169Z" fill="#EEE9D9" stroke="#A0AEA1" />
          <path d="M158 368H497V380H158Z" fill="#D6B779" />
          <text x="325" y="410" textAnchor="middle" fill="#778E81" fontSize="11" letterSpacing="3">
            INFORMATION
          </text>
        </g>
      ) : (
        <g>
          <path d="M254 361H396V446H254Z" fill="#EEE9D9" stroke="#A0AEA1" />
          <path d="M267 348H383V369H267Z" fill="#C7503F" />
          <text x="325" y="362" textAnchor="middle" fill="#FFF9EC" fontSize="8" letterSpacing="2">
            YOUR NEXT CHAPTER
          </text>
        </g>
      )}
    </svg>
  );
}

export function InterestPreview() {
  return (
    <div className="rail-product-preview rail-interest-preview">
      <div className="rail-preview-top">
        <span>
          <i /> NEXUS / FIND YOUR PATH
        </span>
        <Badge variant="neutral">Example preview</Badge>
      </div>
      <Card className="rail-preview-main-card">
        <div className="rail-preview-title">
          <Icon name="target" className="h-5 w-5" />
          <span>Your interest profile</span>
        </div>
        <h3>
          A little more <em>you.</em>
        </h3>
        <p>Discover the activities and work environments you enjoy.</p>
        <HollandCodePlate code="ISA" className="rail-preview-code" />
        <div className="rail-interest-bars" aria-label="Illustrative interest dimensions">
          {[
            ['Investigative', 86],
            ['Social', 72],
            ['Artistic', 61],
          ].map(([label, width]) => (
            <div key={label}>
              <span>{label}</span>
              <div>
                <i style={{ width: `${width}%` }} />
              </div>
            </div>
          ))}
        </div>
        <Link to="/find-your-path/assessment" className="rail-preview-action">
          Discover my interests <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </Card>
      <div className="rail-preview-foot">
        <Icon name="compass" className="h-4 w-4" />
        <span>36 questions. A clearer starting point.</span>
      </div>
    </div>
  );
}

const views = [
  { id: 'courses', label: 'Courses', icon: 'book' },
  { id: 'scholarships', label: 'Scholarships', icon: 'scholarship' },
  { id: 'guidance', label: 'Guidance', icon: 'chat' },
];

export function GuidancePreview() {
  const [view, setView] = useState('courses');
  return (
    <div className="rail-product-preview rail-guidance-preview">
      <div className="rail-preview-top">
        <span>
          <i /> NEXUS / YOUR POSSIBILITIES
        </span>
        <Badge variant="neutral">Example preview</Badge>
      </div>
      <div className="rail-preview-tabs" aria-label="Preview Nexus features">
        {views.map((item) => (
          <button key={item.id} onClick={() => setView(item.id)} aria-pressed={view === item.id}>
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
      <div className="rail-preview-feature" aria-live="polite">
        {view === 'courses' && (
          <>
            <div className="rail-preview-section-title">
              <span>YOUR NEXT POSSIBILITIES</span>
              <h3>Routes worth exploring.</h3>
            </div>
            <Card className="rail-preview-course">
              <Badge variant="success">Course exploration</Badge>
              <h4>Computer science</h4>
              <p>Explore study routes, entry requirements and where they could lead.</p>
              <div className="rail-preview-reasons">
                <span>
                  <Icon name="check" className="h-4 w-4" /> Connect interests with study options
                </span>
                <span>
                  <Icon name="check" className="h-4 w-4" /> Understand the reasons behind a match
                </span>
              </div>
              <Link to="/recommendations" className="rail-preview-action">
                Explore courses <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </Card>
            <div className="rail-preview-career">
              <Icon name="career" className="h-5 w-5" />
              <div>
                <strong>Where could it take you?</strong>
                <span>Discover careers and the paths between them.</span>
              </div>
              <Link to="/careers" aria-label="Explore career pathways">
                <Icon name="arrowUpRight" className="h-5 w-5" />
              </Link>
            </div>
          </>
        )}
        {view === 'scholarships' && (
          <>
            <div className="rail-preview-section-title">
              <span>OPPORTUNITIES AHEAD</span>
              <h3>Support for your next step.</h3>
            </div>
            <Card className="rail-preview-course">
              <Badge variant="success">Scholarship discovery</Badge>
              <h4>A little support. More possibility.</h4>
              <p>Browse funding opportunities and review the requirements that matter to you.</p>
              <div className="rail-preview-reasons">
                <span>
                  <Icon name="check" className="h-4 w-4" /> Check eligibility against your profile
                </span>
                <span>
                  <Icon name="bookmark" className="h-4 w-4" /> Save opportunities for later
                </span>
              </div>
              <Link to="/scholarships" className="rail-preview-action">
                Browse scholarships <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </Card>
          </>
        )}
        {view === 'guidance' && (
          <>
            <div className="rail-preview-section-title">
              <span>A LITTLE GUIDANCE</span>
              <h3>You don’t have to navigate alone.</h3>
            </div>
            <Card className="rail-preview-chat">
              <div className="rail-chat-question">How do I start exploring my options?</div>
              <div className="rail-chat-answer">
                <Icon name="sparkles" className="h-5 w-5" />
                <p>
                  Start with what interests you. Explore your strengths, compare a few study routes
                  and keep room for possibilities.
                </p>
              </div>
              <p className="rail-preview-chat-note">
                Illustrative conversation. Your guidance starts with you.
              </p>
              <Link to="/register" className="rail-preview-action">
                Start your journey <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
