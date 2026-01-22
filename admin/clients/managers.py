from django.db import models
from django.conf import settings


class AccountQuerySet(models.QuerySet):
    def active(self, *args, **kwargs):
        # kwargs["status"] = self.model.Status.ACTIVE
        kwargs["currency__is_active"] = True
        return self.filter(*args, **kwargs)

    def default(self, currency_id=settings.DEFAULT_CURRENCY_ID):
        return self.filter(currency_id=currency_id).order_by("created_at").first()
