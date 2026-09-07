/**
 * The one check that removes us from the trust equation.
 *
 * Everything else about a transfer is safe because of how it is built. This
 * step is different: the two devices are introduced through our server, and a
 * service that chose to misbehave could put itself in the middle. Comparing
 * this code is what closes that — if both people see the same characters,
 * there is nobody between them, and nothing we could do would fake it.
 *
 * The wording is written twice on purpose. The same sentence on both screens
 * would be vague on both: a sender is asking about a person they are sending
 * TO, a receiver about a person the file came FROM, and the thing each should
 * do if the codes disagree is different — one has not sent anything yet, the
 * other already has a file sitting in front of them. Copy that says "the other
 * person" to everybody makes the reader do that translation themselves, at the
 * exact moment they are trying to decide whether to trust something.
 *
 * Deliberately quiet, and deliberately not a blocking step. Most people
 * sending a holiday photo will never look at it, and stopping everyone to
 * demand a comparison would tax every transfer to answer a rare threat.
 *
 * The wording is reassurance, not a warning, and that is a deliberate choice
 * rather than a softening of the truth. A panel that leads with what to do if
 * someone is intercepting you teaches every ordinary user that interception is
 * something they should be worrying about on an ordinary transfer, which is
 * both untrue and the fastest way to make a safe product feel unsafe. It says
 * what the code is for; anyone who wants the failure case has the security
 * page, which spells it out.
 */
export function VerificationCode({ code, role }: { code: string; role: "sender" | "receiver" }) {
  return (
    <div className="mt-6 bg-lime-pale px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red">Private connection</p>
      <p className="mt-2 font-mono text-[22px] font-bold tracking-[0.18em] text-black">{code}</p>
      <p className="mt-2 max-w-md text-[13px] font-medium leading-[1.5] text-black">
        {role === "sender" ? (
          <>
            The person you are sending to should see this same code. Reading it out to them is a quick way to be
            sure your file is going only to them.
          </>
        ) : (
          <>
            The person who sent this should see this same code. Asking them to read theirs out is a quick way to be
            sure the file came only from them.
          </>
        )}
      </p>
    </div>
  );
}
