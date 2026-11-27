import { describe, expect, test } from "bun:test";
import { invitationEmail, resetPasswordEmail, verificationEmail } from "./emailContent";

const user = { email: "ana@example.com", name: "Ana" };
const url = "https://app.example/api/auth/verify-email?token=abc&callbackURL=%2Fanalytics";
const invite = {
  to: "rui@example.com",
  url: "https://app.example/accept-invitation/inv_1",
  organizationName: "Acme",
  inviterName: "Ana",
  inviterEmail: "ana@example.com",
};

describe("verification email", () => {
  test("English", () => {
    const email = verificationEmail("en", { user, url });
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Confirm your email for AgentSDR");
    expect(email.text).toBe(
      `Welcome to AgentSDR, Ana. Confirm this is your email address to finish creating your account.\n\nConfirm email: ${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    );
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain(">Confirm email</a>");
    expect(email.html).toContain("Or paste this link into your browser:");
  });

  test("Brazilian Portuguese", () => {
    const email = verificationEmail("pt-BR", { user, url });
    expect(email.subject).toBe("Confirme seu e-mail no AgentSDR");
    expect(email.text).toBe(
      `Boas-vindas ao AgentSDR, Ana. Confirme que este é o seu e-mail para concluir a criação da conta.\n\nConfirmar e-mail: ${url}\n\nSe você não pediu isso, ignore este e-mail.`,
    );
    expect(email.html).toContain('<html lang="pt-BR">');
    expect(email.html).toContain(">Confirmar e-mail</a>");
    expect(email.html).toContain("Ou cole este link no navegador:");
    expect(email.html).not.toContain("Or paste this link");
  });
});

describe("password reset email", () => {
  test("English", () => {
    const email = resetPasswordEmail("en", { user, url });
    expect(email.subject).toBe("Reset your AgentSDR password");
    expect(email.text).toContain("Someone asked to reset the password for this AgentSDR account.");
    expect(email.text).toContain(`Choose a new password: ${url}`);
    expect(email.html).toContain(">Choose a new password</a>");
  });

  test("Brazilian Portuguese", () => {
    const email = resetPasswordEmail("pt-BR", { user, url });
    expect(email.subject).toBe("Redefinir sua senha do AgentSDR");
    expect(email.text).toContain("Alguém pediu para redefinir a senha desta conta do AgentSDR.");
    expect(email.text).toContain(`Redefinir senha: ${url}`);
    expect(email.text).toContain("Se você não pediu isso, ignore este e-mail.");
    expect(email.html).toContain(">Redefinir senha</a>");
  });
});

describe("invitation email", () => {
  test("English", () => {
    const email = invitationEmail("en", invite);
    expect(email.to).toBe("rui@example.com");
    expect(email.subject).toBe("Ana invited you to Acme on AgentSDR");
    expect(email.text).toBe(
      "Ana (ana@example.com) invited you to join Acme on AgentSDR.\n\nAccept invitation: https://app.example/accept-invitation/inv_1\n\nThis invitation expires in 7 days. If you weren't expecting it, you can ignore this email.",
    );
    expect(email.html).toContain(">Accept invitation</a>");
  });

  test("Brazilian Portuguese", () => {
    const email = invitationEmail("pt-BR", invite);
    expect(email.subject).toBe("Ana convidou você para Acme no AgentSDR");
    expect(email.text).toBe(
      "Ana (ana@example.com) convidou você para participar de Acme no AgentSDR.\n\nAceitar convite: https://app.example/accept-invitation/inv_1\n\nEste convite expira em 7 dias. Se você não esperava por ele, ignore este e-mail.",
    );
    expect(email.html).toContain(">Aceitar convite</a>");
    // The invitation has its own closing line, so the default one is not added.
    expect(email.text).not.toContain("Se você não pediu isso");
  });

  test("names are escaped in the HTML and left alone in the subject and the text part", () => {
    const email = invitationEmail("pt-BR", { ...invite, organizationName: "Tom & Ana's <Lab>", inviterName: "O'Neil {x}" });
    expect(email.subject).toBe("O'Neil {x} convidou você para Tom & Ana's <Lab> no AgentSDR");
    expect(email.text).toContain("participar de Tom & Ana's <Lab> no AgentSDR.");
    expect(email.html).toContain("O&#39;Neil {x} (ana@example.com) convidou você para participar de Tom &amp; Ana&#39;s &lt;Lab&gt; no AgentSDR.");
    expect(email.html).not.toContain("<Lab>");
  });
});
