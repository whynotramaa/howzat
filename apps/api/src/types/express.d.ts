declare global {
  namespace Express {
    interface Request {
      /**
       * Set by requireAuth; absent on public routes. Deliberately carries no
       * role: what a user may do is decided per resource — owning the
       * tournament, or holding an assignment for the match — never by a flag
       * on the account.
       */
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
