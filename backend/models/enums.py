from .djangoise import TextChoices


class OperationKind(TextChoices):
    # Управление карточным счётом. Выделяем, так как процессинг и тарифы
    #  отличаются от регулярного счёта
    CARD_OPEN = "CO", "CARD OPEN"
    CARD_UPDATE = "CU", "CARD UPDATE"
    CARD_TOPUP = "CT", "CARD TOPUP"
    CARD_BLOCK = "CB", "CARD BLOCK"
    CARD_RESTORE = "CR", "CARD RESTORE"
    CARD_CLOSE = "CC", "CARD CLOSE"
    CARD_BANNED = "CD", "CARD BANNED"

    # Операции по счёту. Движения средств. Типа DML
    DEPOSIT = "DE", "DEPOSIT"
    WITHDRAW = "WI", "WITHDRAW"
    SERVICE = "SE", "SERVICE"
    SYSTEM = "SY", "SYSTEM"
    ADJUSTMENT = "AJ", "ADJUSTMENT"
