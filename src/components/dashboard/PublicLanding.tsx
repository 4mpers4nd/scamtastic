import Link from 'next/link';
import Header from '@/components/Header';
import Network from '@/components/Network';

export default function PublicLanding() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <Network />
          <div className="heroText">
            <div className="tag">
              <span className="live" /> A PRIVATE SOCIAL EXPERIMENT
            </div>
            <h1>
              TRUST IS A<br />
              <span>VULNERABILITY.</span>
            </h1>
            <p>
              A network of opportunities. An economy of uncertainty. A world
              where reputation is earned, deals are made, and nothing is quite
              what it seems.
            </p>
            <div className="actions">
              <Link className="button primary" href="/apply">
                Request Access <span>↗</span>
              </Link>
              <Link className="button secondary" href="/login">
                Member Login →
              </Link>
            </div>
            <div className="micro">
              INVITE-ONLY // 100% FREE // FICTIONAL ECONOMY
            </div>
          </div>
          <div className="rotate">↻ DRAG TO ROTATE NETWORK</div>
        </section>
        <section className="section" id="about">
          <div className="tag">// THE PROTOCOL</div>
          <h2>
            Nothing is guaranteed.
            <br />
            <span>Especially trust.</span>
          </h2>
          <div className="grid">
            <article className="card">
              <div className="cardNum">01 /</div>
              <h3>Earn your place.</h3>
              <p>
                Every player is reviewed before joining. The network is small
                by design, not by accident.
              </p>
            </article>
            <article className="card">
              <div className="cardNum">02 /</div>
              <h3>Build the economy.</h3>
              <p>
                Opportunities are created by players. Negotiate, collaborate,
                and decide who deserves your trust.
              </p>
            </article>
            <article className="card">
              <div className="cardNum">03 /</div>
              <h3>Question everything.</h3>
              <p>
                Bits are a fictional placeholder. No purchases, cash-outs, or
                real-world value. Just strategy.
              </p>
            </article>
          </div>
        </section>
        <section className="callout">
          <div className="tag">// ACCESS CONTROL</div>
          <h2>
            THE NETWORK IS
            <br />
            NOT OPEN TO EVERYONE.
          </h2>
          <p>But you can ask nicely. It probably won&apos;t help.</p>
          <Link className="button primary" href="/apply">
            Apply to Join ↗
          </Link>
        </section>
      </main>
      <footer>
        <span>© SCAMTASTIC // ALL RIGHTS QUESTIONABLE</span>
        <span>THIS IS A GAME. NOT A FINANCIAL SERVICE.</span>
      </footer>
    </>
  );
}
