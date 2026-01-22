from tortoise import fields
from tortoise.models import Model


class HealthCheck(Model):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=50, default="backend")
